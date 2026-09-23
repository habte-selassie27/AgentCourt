"""
Minimal genlayer module stub so intelligent-contract sources import under CPython.

Only the surface used by AgentCourtCore / ResolutionManager and pure helpers is
provided. Nondeterministic APIs are monkeypatched per-test where needed.
"""

from __future__ import annotations

import hashlib
import sys
import types
from typing import Any, Callable, get_origin


class _UserError(Exception):
    def __init__(self, message: str = ""):
        super().__init__(message)
        self.message = message

    def __str__(self) -> str:
        return self.message


class _Return:
    def __init__(self, calldata: Any):
        self.calldata = calldata


class _VMError:
    def __init__(self, message: str = ""):
        self.message = message


class Address(str):
    def __new__(cls, value: Any):
        return super().__new__(cls, str(value))


def u256(value: Any = 0) -> int:
    return int(value)


class TreeMap(dict):
    def get(self, key, default=None):  # type: ignore[override]
        return dict.get(self, key, default)


class _Lazy:
    def __init__(self, value: Any):
        self._value = value

    def get(self):
        return self._value


def _identity_decorator(fn):
    return fn


class _Public:
    write = staticmethod(_identity_decorator)
    view = staticmethod(_identity_decorator)


class _Contract:
    def __init_subclass__(cls, **kwargs):
        super().__init_subclass__(**kwargs)
        ann = {}
        for base in reversed(cls.__mro__):
            ann.update(getattr(base, "__annotations__", {}) or {})
        tm_names = []
        for name, hint in ann.items():
            if name.startswith("_"):
                continue
            text = hint if isinstance(hint, str) else getattr(hint, "__name__", "")
            origin = get_origin(hint)
            if origin is not None:
                text = getattr(origin, "__name__", text)
            if text == "TreeMap" or (isinstance(hint, str) and "TreeMap" in hint):
                tm_names.append(name)
            elif origin is TreeMap or hint is TreeMap:
                tm_names.append(name)
        if not tm_names:
            return
        prev = cls.__dict__.get("__init__")

        def _wrapped(self, *args, **kwargs):
            for n in tm_names:
                if n not in self.__dict__:
                    setattr(self, n, TreeMap())
            if prev is not None:
                prev(self, *args, **kwargs)

        cls.__init__ = _wrapped


class _Message:
    sender_address = Address("0x0000000000000000000000000000000000000001")
    origin_address = Address("0x0000000000000000000000000000000000000001")
    contract_address = Address("0x0000000000000000000000000000000000000002")
    value = 0
    chain_id = 61999


class _Web:
    @staticmethod
    def get(url, **kwargs):
        raise NotImplementedError("stub web.get — monkeypatch in tests")

    @staticmethod
    def render(url, **kwargs):
        raise NotImplementedError("stub web.render — monkeypatch in tests")

    @staticmethod
    def request(url, **kwargs):
        raise NotImplementedError("stub web.request — monkeypatch in tests")


class _Nondet:
    web = _Web()

    @staticmethod
    def exec_prompt(prompt, **kwargs):
        raise NotImplementedError("stub exec_prompt — monkeypatch in tests")


class _VM:
    Return = _Return
    VMError = _VMError
    UserError = _UserError

    @staticmethod
    def run_nondet_unsafe(leader_fn, validator_fn):
        result = leader_fn()
        if not validator_fn(_Return(result)):
            raise _UserError("validator disagreed")
        return result

    @staticmethod
    def run_nondet(leader_fn, validator_fn, **kwargs):
        return _VM.run_nondet_unsafe(leader_fn, validator_fn)


class _ContractProxy:
    def __init__(self, address):
        self._address = address
        self._views: dict[str, Callable[..., Any]] = {}
        self._writes: list[tuple[str, tuple, dict]] = []

    def register_view(self, name, fn):
        self._views[name] = fn

    def view(self, **kwargs):
        outer = self

        class _ViewNS:
            def __getattr__(self, item):
                def call(*args, **kw):
                    if item not in outer._views:
                        raise AttributeError(item)
                    return outer._views[item](*args, **kw)

                return call

        return _ViewNS()

    def emit(self, **kwargs):
        outer = self

        class _EmitNS:
            def __getattr__(self, item):
                def call(*args, **kw):
                    outer._writes.append((item, args, kw))
                    return None

                return call

        return _EmitNS()


_CONTRACT_REGISTRY: dict[str, _ContractProxy] = {}


def get_contract_at(address):
    key = str(address)
    if key not in _CONTRACT_REGISTRY:
        _CONTRACT_REGISTRY[key] = _ContractProxy(Address(key))
    return _CONTRACT_REGISTRY[key]


def reset_contract_registry():
    _CONTRACT_REGISTRY.clear()


def register_contract_view(address, name, fn):
    get_contract_at(address).register_view(name, fn)


def contract_writes(address):
    return get_contract_at(address)._writes


class _GL:
    Contract = _Contract
    public = _Public()
    message = _Message()
    message_raw = {
        "contract_address": _Message.contract_address,
        "sender_address": _Message.sender_address,
        "origin_address": _Message.origin_address,
        "value": 0,
        "chain_id": 61999,
        "datetime": "2026-09-23T12:00:00+00:00",
    }
    UserError = _UserError
    vm = _VM()
    nondet = _Nondet()
    get_contract_at = staticmethod(get_contract_at)

    class eq_principle:
        @staticmethod
        def strict_eq(fn):
            return fn()

        @staticmethod
        def prompt_comparative(fn, criteria=None):
            return fn()

        @staticmethod
        def prompt_non_comparative(fn, *a, **k):
            return fn()


def Keccak256(data: bytes = b""):
    """Stand-in for genlayer's pure-Python Keccak256 (hashlib-compatible API).

    Real keccak differs from sha3, but tests only require a deterministic
    32-byte digest with a .hexdigest() interface — no fixed vectors.
    """
    return hashlib.sha3_256(data)


def install() -> types.ModuleType:
    """Install stub modules named `genlayer` into sys.modules if missing."""
    if "genlayer" in sys.modules and getattr(sys.modules["genlayer"], "__agentcourt_stub__", False):
        return sys.modules["genlayer"]

    mod = types.ModuleType("genlayer")
    mod.__agentcourt_stub__ = True  # type: ignore[attr-defined]
    mod.gl = _GL()
    mod.Address = Address
    mod.u256 = u256
    mod.TreeMap = TreeMap
    mod.Keccak256 = Keccak256
    mod.keccak256 = None

    # Common type aliases
    for name in ("bigint", "i256", "u32", "u64", "u128"):
        setattr(mod, name, int)

    sys.modules["genlayer"] = mod
    return mod


# Auto-install on import
install()
