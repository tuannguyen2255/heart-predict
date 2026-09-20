"""Execute the EDA notebook with this Python interpreter and save a rendered copy."""
from pathlib import Path
import os
import sys

import nbformat
from nbclient import NotebookClient
from jupyter_client import KernelManager


def main():
    root = Path(__file__).resolve().parents[1]
    source = root / "notebook/heart_disease_eda.ipynb"
    notebook = nbformat.read(source, as_version=4)
    nbformat.validate(notebook)
    manager = KernelManager(kernel_name="python3")
    # Use the active project environment, even if another kernel is installed globally.
    manager.kernel_spec.argv[0] = sys.executable
    client = NotebookClient(notebook, km=manager, timeout=180, resources={"metadata": {"path": str(root)}})
    try:
        client.execute(env={**os.environ, "IPYTHONDIR": str(root / "notebook/eda_outputs/.ipython")})
    finally:
        if manager.has_kernel:
            manager.shutdown_kernel(now=True)
        manager.cleanup_resources()
    destination = root / "notebook/eda_outputs/heart_disease_eda.executed.ipynb"
    destination.parent.mkdir(parents=True, exist_ok=True)
    nbformat.write(notebook, destination)
    print(f"Executed with {sys.executable}")
    print(f"Notebook saved to {destination}")


if __name__ == "__main__":
    main()
