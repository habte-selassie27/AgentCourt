import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'intelligent-contracts'))

# Install genlayer stub before any contract import.
from tests.genlayer_stub import install  # noqa: E402

install()
