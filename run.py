"""
Run script to start the CETLOE Debate AI application.
Installs/builds the Next.js frontend when needed, then starts FastAPI (serves API + static UI).
"""

import argparse
import os
import shutil
import subprocess
import sys
import time
import webbrowser
from pathlib import Path

# Project root .env (same folder as this script) — load before cwd changes
_PROJECT_ROOT = Path(__file__).resolve().parent
_FRONTEND_DEV_PROCESS = None


def ensure_frontend_dev_ready() -> bool:
    """Ensure frontend dependencies are installed for `npm run dev`."""
    frontend = _PROJECT_ROOT / "frontend"
    pkg = frontend / "package.json"

    if not pkg.is_file():
        print("ERROR: frontend/package.json not found.")
        return False

    npm = shutil.which("npm")
    if not npm:
        print("ERROR: npm not found. Install Node.js 20+ from https://nodejs.org/ and ensure npm is on PATH.")
        return False

    # npm install is idempotent and keeps lockfile in sync during active dev.
    print("Ensuring frontend dependencies (npm install)...")
    code = _run_npm(frontend, ["install"])
    if code != 0:
        print("ERROR: npm install failed.")
        return False

    print("Frontend dev dependencies ready.\n")
    return True


def start_frontend_dev_server() -> bool:
    """Start Next.js dev server (npm run dev) as a background child process."""
    global _FRONTEND_DEV_PROCESS
    frontend = _PROJECT_ROOT / "frontend"
    print("Starting frontend dev server (npm run dev) on http://localhost:3000 ...")

    if sys.platform == "win32":
        _FRONTEND_DEV_PROCESS = subprocess.Popen("npm run dev", cwd=str(frontend), shell=True)
    else:
        _FRONTEND_DEV_PROCESS = subprocess.Popen(["npm", "run", "dev"], cwd=str(frontend))
    return True


def stop_frontend_dev_server() -> None:
    """Terminate frontend dev child process if it is running."""
    global _FRONTEND_DEV_PROCESS
    p = _FRONTEND_DEV_PROCESS
    if not p:
        return
    if p.poll() is None:
        p.terminate()
        try:
            p.wait(timeout=5)
        except Exception:
            p.kill()
    _FRONTEND_DEV_PROCESS = None


def _run_npm(frontend: Path, args: list) -> int:
    """Run npm with cwd under frontend/. On Windows, shell=True finds npm.cmd reliably."""
    if sys.platform == "win32":
        cmd_str = "npm " + " ".join(args)
        return subprocess.run(cmd_str, cwd=str(frontend), shell=True).returncode
    return subprocess.run(["npm", *args], cwd=str(frontend)).returncode


def check_dependencies():
    """Check if required dependencies are installed."""
    try:
        import fastapi
        import uvicorn
        import httpx
        import google.generativeai
        return True
    except ImportError as e:
        print(f"Missing dependency: {e.name}")
        return False


def install_dependencies():
    """Install dependencies from requirements.txt."""
    requirements_path = Path(__file__).parent / "backend" / "requirements.txt"
    
    if not requirements_path.exists():
        print("Error: backend/requirements.txt not found")
        return False
    
    print("Installing dependencies...")
    result = subprocess.run(
        [sys.executable, "-m", "pip", "install", "-r", str(requirements_path)],
        capture_output=True,
        text=True
    )
    
    if result.returncode != 0:
        print(f"Error installing dependencies: {result.stderr}")
        return False
    
    print("Dependencies installed successfully!")
    return True


def check_env_file():
    """Check if .env file exists with required keys."""
    env_path = Path(__file__).parent / ".env"
    
    if not env_path.exists():
        print("\n" + "=" * 50)
        print("WARNING: .env file not found!")
        print("=" * 50)
        print("\nPlease create a .env file with:")
        print("  DEEPGRAM_API_KEY=your_deepgram_key")
        print("  GEMINI_API_KEY=your_gemini_key")
        print("\nYou can copy .env.example as a template.")
        print("=" * 50 + "\n")
        return False
    
    # Check if keys are set
    with open(env_path, 'r') as f:
        content = f.read()
    
    if 'your_' in content.lower() or content.strip() == '':
        print("\n" + "=" * 50)
        print("WARNING: API keys not configured in .env file!")
        print("=" * 50)
        print("\nPlease update .env with your actual API keys:")
        print("  DEEPGRAM_API_KEY=your_actual_key")
        print("  GEMINI_API_KEY=your_actual_key")
        print("=" * 50 + "\n")
        return False
    
    return True


def run_server():
    """Run the FastAPI server in dev mode."""
    try:
        from dotenv import load_dotenv
        load_dotenv(_PROJECT_ROOT / ".env")
    except ImportError:
        pass

    # Change to backend directory
    backend_path = _PROJECT_ROOT / "backend"
    os.chdir(backend_path)
    
    # Add backend to path so imports work
    sys.path.insert(0, str(backend_path))
    
    # Import and run
    import uvicorn
    from config import get_settings
    
    settings = get_settings()
    port = settings.port
    
    print("\n" + "=" * 50)
    print("  CETLOE Debate AI")
    print("=" * 50)
    print(f"\n  Frontend (Next dev): http://localhost:3000")
    print(f"  Backend API: http://localhost:{port}")
    print(f"  Health check: http://localhost:{port}/api/health")
    print("\n  Press Ctrl+C to stop the server")
    print("=" * 50 + "\n")
    
    # Open browser after short delay
    def open_browser():
        time.sleep(1.5)
        webbrowser.open("http://localhost:3000")
    
    import threading
    browser_thread = threading.Thread(target=open_browser, daemon=True)
    browser_thread.start()
    
    # Run server
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=True,
        log_level="info"
    )


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(description="CETLOE Debate AI — backend + frontend dev server")
    parser.parse_args()

    print("\n" + "=" * 50)
    print("  Starting CETLOE Debate AI...")
    print("=" * 50 + "\n")

    # Check dependencies
    if not check_dependencies():
        print("Installing missing dependencies...")
        if not install_dependencies():
            print("Failed to install dependencies. Please install manually:")
            print("  pip install -r backend/requirements.txt")
            sys.exit(1)

    # Check env file
    check_env_file()

    if not ensure_frontend_dev_ready():
        sys.exit(1)

    if not start_frontend_dev_server():
        sys.exit(1)

    # Run the server
    try:
        run_server()
    except KeyboardInterrupt:
        print("\n\nServer stopped.")
    except Exception as e:
        print(f"\nError starting server: {e}")
        sys.exit(1)
    finally:
        stop_frontend_dev_server()


if __name__ == "__main__":
    main()
