import os
import json
import argparse
from sentence_transformers import SentenceTransformer, util
import torch
from pathlib import Path
from typing import List, Dict, Any
import fitz  # PyMuPDF
from collections import defaultdict

# Use a fast and effective pre-trained model for semantic search
MODEL_NAME = 'all-MiniLM-L6-v2'

def load_json_file(filepath: Path) -> Any:
    """Loads a JSON file from the given path."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        print(f"Error loading {filepath}: {e}")
        return None

def extract_text_under_heading(doc: fitz.Document, start_page_num: int, heading_text: str, next_heading: Dict[str, Any] = None) -> Dict[str, Any]:
    """
    Extracts text and its quad points from a PDF under a specific heading.
    It spans pages if necessary, until the next heading is found.
    """
    text_content = []
    heading_quads = []
    content_quads = []
    found_heading = False
    
    # Normalize heading text for more reliable matching
    normalized_heading = " ".join(heading_text.lower().split())

    # Determine the page where the extraction should stop.
    end_page = next_heading['page_number'] if next_heading else len(doc)
    
    try:
        for page_num in range(start_page_num - 1, end_page):
            if page_num >= len(doc):
                break
            
            page = doc.load_page(page_num)
            # Use get_text("dict") to get detailed info including coordinates
            blocks = page.get_text("dict", flags=fitz.TEXTFLAGS_SEARCH)["blocks"]

            for block in blocks:
                if "lines" not in block:
                    continue
                
                for line in block["lines"]:
                    for span in line["spans"]:
                        span_text = span["text"]
                        normalized_span_text = " ".join(span_text.lower().split())

                        if not found_heading and normalized_heading in normalized_span_text:
                            found_heading = True
                            heading_quads.extend(span['bbox'] for _ in range(1)) # Use bbox as quad
                            # Handle content in the same block as the heading
                            if len(normalized_span_text) > len(normalized_heading):
                                content_after = span_text[span_text.lower().find(normalized_heading) + len(normalized_heading):].strip()
                                if content_after:
                                    text_content.append(content_after)
                                    content_quads.extend(span['bbox'] for _ in range(1))
                            continue

                        if found_heading:
                            if next_heading and (page_num + 1) == next_heading['page_number']:
                                next_heading_normalized = " ".join(next_heading['text'].lower().split())
                                if next_heading_normalized in normalized_span_text:
                                    return {
                                        "summary": "\n".join(text_content).strip(),
                                        "heading_quads": heading_quads,
                                        "content_quads": content_quads
                                    }
                            
                            text_content.append(span_text.strip())
                            content_quads.append(span['bbox'])

        return {
            "summary": "\n".join(text_content).strip(),
            "heading_quads": heading_quads,
            "content_quads": content_quads
        }

    except Exception as e:
        return {
            "summary": f"Error during summary extraction: {e}",
            "heading_quads": [],
            "content_quads": []
        }

def find_relevant_sections(selected_text_data: Dict[str, Any], json_dir: Path, pdf_dir: Path) -> List[Dict[str, Any]]:
    """
    Finds the top 5 relevant sections and extracts the text and quad points under each heading.
    """
    if not selected_text_data or "selected_text" not in selected_text_data:
        print("Error: Invalid selected text data provided.")
        return []

    # 1. Load the pre-trained Sentence Transformer model
    print(f"Loading model: {MODEL_NAME}...")
    model = SentenceTransformer(MODEL_NAME)
    print("Model loaded successfully.")

    selected_text = selected_text_data["selected_text"]
    
    # 2. Encode the selected text (query)
    query_embedding = model.encode(selected_text, convert_to_tensor=True, show_progress_bar=False)

    # 3. Aggregate all headings and group them by document
    all_headings = []
    doc_headings = defaultdict(list)
    json_files = sorted(list(json_dir.glob("*.json")))
    if not json_files:
        print(f"No JSON files found in {json_dir}")
        return []

    print(f"Aggregating headings from {len(json_files)} JSON files...")
    for filepath in json_files:
        data = load_json_file(filepath)
        if data and "outline" in data:
            source_doc_name = filepath.stem + ".pdf"
            sorted_outline = sorted(data.get("outline", []), key=lambda h: h.get('page', 0))
            for i, heading in enumerate(sorted_outline):
                heading_info = {
                    "text": heading.get("text", ""),
                    "source_document": source_doc_name,
                    "page_number": heading.get("page", -1),
                    "doc_index": i
                }
                all_headings.append(heading_info)
                doc_headings[source_doc_name].append(heading_info)

    if not all_headings:
        print("No headings found in any JSON file.")
        return []

    # 4. Prepare heading texts for batch encoding
    heading_texts = [heading['text'] for heading in all_headings]
    
    # 5. Encode all headings
    print(f"Encoding {len(heading_texts)} headings...")
    corpus_embeddings = model.encode(heading_texts, convert_to_tensor=True, show_progress_bar=True)

    # 6. Compute cosine similarity
    print("Calculating similarity scores...")
    cosine_scores = util.pytorch_cos_sim(query_embedding, corpus_embeddings)[0]

    # 7. Get the top 5 scores and their indices
    top_results = torch.topk(cosine_scores, k=min(5, len(all_headings)))

    # 8. Format the results and extract summaries and quads
    formatted_sections = []
    open_docs = {}
    try:
        for rank, (score, idx) in enumerate(zip(top_results[0], top_results[1]), 1):
            original_section = all_headings[idx]
            doc_name = original_section["source_document"]
            
            current_doc_headings = doc_headings[doc_name]
            doc_idx = original_section['doc_index']
            next_heading = current_doc_headings[doc_idx + 1] if doc_idx + 1 < len(current_doc_headings) else None

            if doc_name not in open_docs:
                pdf_path = pdf_dir / doc_name
                if pdf_path.exists():
                    open_docs[doc_name] = fitz.open(pdf_path)
                else:
                    formatted_sections.append({
                        "document": doc_name, "section_title": original_section["text"],
                        "page_number": original_section["page_number"], "importance_rank": rank,
                        "summary_of_paragraph_under_section": f"PDF not found at {pdf_path}",
                        "quad_points": {"heading": [], "content": []}
                    })
                    continue
            
            doc = open_docs[doc_name]
            extraction_result = extract_text_under_heading(
                doc,
                original_section["page_number"],
                original_section["text"],
                next_heading
            )

            formatted_sections.append({
                "document": doc_name,
                "section_title": original_section["text"],
                "page_number": original_section["page_number"],
                "importance_rank": rank,
                "summary_of_paragraph_under_section": extraction_result["summary"] if extraction_result["summary"] else original_section["text"],
                "quad_points": {
                    "heading": extraction_result["heading_quads"],
                    "content": extraction_result["content_quads"]
                }
            })
    finally:
        for doc in open_docs.values():
            doc.close()

    return formatted_sections

def main():
    """Main function to run the script from the command line."""
    parser = argparse.ArgumentParser(description="Find relevant sections in documents based on semantic search.")
    parser.add_argument("--input", 
                        default="data/selected_text/selected_text.json",
                        help="Path to the input JSON file with the selected text.")
    parser.add_argument("--json_dir", 
                        default="data/json",
                        help="Path to the directory containing JSON files with document outlines.")
    parser.add_argument("--pdf_dir",
                        default="data/pdfs",
                        help="Path to the directory containing the original PDF files.")
    parser.add_argument("--output", 
                        default="data/output/relevant_sections.json",
                        help="Path to the output JSON file for the results.")
    
    args = parser.parse_args()

    input_path = Path(args.input)
    json_dir_path = Path(args.json_dir)
    pdf_dir_path = Path(args.pdf_dir)
    output_path = Path(args.output)

    selected_text_data = load_json_file(input_path)
    if not selected_text_data:
        return

    top_sections = find_relevant_sections(selected_text_data, json_dir_path, pdf_dir_path)

    output_data = {"extracted_sections": top_sections}

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, indent=4)
        
    print(f"\nTop 5 relevant sections found and saved to {output_path}")
    print(json.dumps(output_data, indent=2))


if __name__ == "__main__":
    main()
