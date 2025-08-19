#!/usr/bin/env python3
"""
Helper script to run the FastAPI server
"""
import uvicorn
import os
from pathlib import Path

if __name__ == "__main__":
    # Change to backend directory
    backend_dir = Path(__file__).parent
    os.chdir(backend_dir)
    
    print(" Starting Document Intelligence API Server...")
    print(" Backend directory:", backend_dir)
    print(" Server will be available at: http://localhost:8000")
    print("API docs will be available at: http://localhost:8000/docs")
    print("=" * 50)
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        reload_dirs=[str(backend_dir)]
    )
