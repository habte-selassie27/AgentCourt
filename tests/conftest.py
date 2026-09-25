import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'intelligent-contracts'))

# Unit tests run contracts against the lightweight stub in tests/genlayer_stub.py.
# The gltest integration suite (tests/integration/) needs the REAL genlayer SDK,
# so it sets AGENTCOURT_REAL_GENLAYER=1 to stop the stub shadowing it in sys.modules.
if os.environ.get('AGENTCOURT_REAL_GENLAYER') != '1':
    from tests.genlayer_stub import install  # noqa: E402

    install()
