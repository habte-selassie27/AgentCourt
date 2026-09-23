# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *
import json


def _days_from_civil(y: int, m: int, d: int) -> int:
    """Days since 1970-01-01 for a proleptic Gregorian date (Howard Hinnant)."""
    y -= 1 if m <= 2 else 0
    era = (y if y >= 0 else y - 399) // 400
    yoe = y - era * 400
    doy = (153 * (m + (-3 if m > 2 else 9)) + 2) // 5 + d - 1
    doe = yoe * 365 + yoe // 4 - yoe // 100 + doy
    return era * 146097 + doe - 719468


def _now_unix() -> int:
    """Unix seconds from GenVM's transaction datetime (ISO-8601, pure integer parse)."""
    raw = getattr(gl, "message_raw", None)
    try:
        iso = raw.get("datetime") if raw is not None else None
    except Exception:
        iso = None
    if not iso:
        return 0
    s = str(iso).strip()
    try:
        if "T" not in s:
            return 0
        date_part, rest = s.split("T", 1)
        y = int(date_part[0:4])
        m = int(date_part[5:7])
        d = int(date_part[8:10])

        time_part = rest
        offset = 0
        cut = -1
        for i, ch in enumerate(rest):
            if i >= 6 and ch in "+-":
                cut = i
                break
        if cut >= 0:
            tz = rest[cut + 1 :].replace(":", "")
            sign = -1 if rest[cut] == "-" else 1
            if len(tz) >= 4:
                offset = sign * (int(tz[0:2]) * 3600 + int(tz[2:4]) * 60)
            elif len(tz) >= 2:
                offset = sign * int(tz[0:2]) * 3600
            time_part = rest[:cut]
        elif rest.endswith(("Z", "z")):
            time_part = rest[:-1]

        if "." in time_part:
            time_part = time_part.split(".", 1)[0]
        hh = int(time_part[0:2])
        mm = int(time_part[3:5])
        ss = int(time_part[6:8]) if len(time_part) >= 8 else 0
        return _days_from_civil(y, m, d) * 86400 + hh * 3600 + mm * 60 + ss - offset
    except Exception:
        return 0


class ResolutionManager(gl.Contract):
    """
    Settlement and appeal authority.

    Settlement accepts only a dispute id and reads the authoritative verdict
    from AgentCourtCore — callers cannot supply verdicts or actions.
    """

    owner: Address
    paused: bool
    core: Address

    next_appeal_id: u256
    appeal_bond: u256
    max_rounds: u256
    appeal_window: u256
    appeals: TreeMap[str, str]
    appeal_exists: TreeMap[str, bool]
    dispute_appeals: TreeMap[str, str]

    next_settlement_nonce: u256
    settled_disputes: TreeMap[str, bool]
    settlement_nonces: TreeMap[str, str]

    def __init__(self):
        self.owner = gl.message.sender_address
        self.paused = False
        self.core = Address("0x0000000000000000000000000000000000000000")
        self.next_appeal_id = u256(1)
        self.appeal_bond = u256(10000000000000000)
        self.max_rounds = u256(3)
        self.appeal_window = u256(604800)
        self.next_settlement_nonce = u256(1)
        # TreeMap storage fields are zero-initialized by GenVM; do not assign here.

    def _require_owner(self):
        if gl.message.sender_address != self.owner:
            raise gl.vm.UserError("Not owner")

    @gl.public.write
    def set_core(self, core_address):
        """One-time wiring of AgentCourtCore after core deployment."""
        self._require_owner()
        if self.core != Address("0x0000000000000000000000000000000000000000"):
            raise gl.vm.UserError("Core already set")
        # Calldata may already be Address; Address(Address) raises TypeError.
        if isinstance(core_address, Address):
            self.core = core_address
        else:
            self.core = Address(core_address)

    @gl.public.write
    def pause(self):
        self._require_owner()
        self.paused = True

    @gl.public.write
    def unpause(self):
        self._require_owner()
        self.paused = False

    @gl.public.write
    def set_appeal_bond(self, new_bond):
        self._require_owner()
        self.appeal_bond = u256(new_bond)

    @gl.public.write
    def set_max_rounds(self, new_max):
        self._require_owner()
        self.max_rounds = u256(new_max)

    @gl.public.write
    def set_appeal_window(self, new_window):
        self._require_owner()
        self.appeal_window = u256(new_window)

    def _require_core(self):
        if self.core == Address("0x0000000000000000000000000000000000000000"):
            raise gl.vm.UserError("Core not configured")
        return gl.get_contract_at(self.core)

    # -------------------------------------------------------------------------
    # Appeals
    # -------------------------------------------------------------------------

    @gl.public.write
    def open_appeal(self, dispute_id, appellant, reason):
        if self.paused:
            raise gl.vm.UserError("Contract is paused")
        if gl.message.sender_address != self.core:
            raise gl.vm.UserError("Only core may open appeals")

        core = gl.get_contract_at(self.core)
        verdict = core.view().get_verdict(int(dispute_id))
        if not isinstance(verdict, dict):
            raise gl.vm.UserError("No verdict to appeal")

        appeal_id = int(self.next_appeal_id)
        self.next_appeal_id = u256(appeal_id + 1)

        appeal = {
            "id": appeal_id,
            "disputeId": int(dispute_id),
            "appellant": str(appellant),
            "reason": str(reason),
            "bond": int(self.appeal_bond),
            "createdAt": _now_unix(),
            "resolved": False,
            "verdictAtOpen": int(verdict.get("verdict", 0)),
            "verdictVersionAtOpen": int(verdict.get("version", 0)),
            "supersedingVerdict": 0,
            "accepted": False,
        }
        self.appeals[str(appeal_id)] = json.dumps(appeal)
        self.appeal_exists[str(appeal_id)] = True

        existing = json.loads(self.dispute_appeals.get(str(dispute_id), "[]"))
        existing.append(appeal_id)
        self.dispute_appeals[str(dispute_id)] = json.dumps(existing)
        return appeal_id

    @gl.public.write
    def resolve_appeal(self, appeal_id):
        """
        Resolve an appeal by comparing the current core verdict to the verdict
        captured when the appeal opened. No caller-supplied superseding verdict.
        """
        if self.paused:
            raise gl.vm.UserError("Contract is paused")
        key = str(appeal_id)
        if not self.appeal_exists.get(key, False):
            raise gl.vm.UserError("Appeal not found")

        appeal = json.loads(self.appeals[key])
        if appeal["resolved"]:
            raise gl.vm.UserError("Appeal already resolved")

        core = self._require_core()
        current = core.view().get_verdict(int(appeal["disputeId"]))
        if not isinstance(current, dict):
            raise gl.vm.UserError("No verdict on core")

        current_version = int(current.get("version", 0))
        opened_version = int(appeal.get("verdictVersionAtOpen", 0))
        current_verdict = int(current.get("verdict", 0))

        if current_version > opened_version or (
            current_verdict != int(appeal.get("verdictAtOpen", 0))
        ):
            appeal["accepted"] = True
            appeal["supersedingVerdict"] = current_verdict
        else:
            appeal["accepted"] = False
            appeal["supersedingVerdict"] = 0

        appeal["resolved"] = True
        self.appeals[key] = json.dumps(appeal)
        return bool(appeal["accepted"])

    @gl.public.view
    def get_appeal(self, appeal_id) -> dict | None:
        data = self.appeals.get(str(appeal_id))
        if data is None:
            return None
        return json.loads(data)

    @gl.public.view
    def get_dispute_appeals(self, dispute_id) -> list:
        return json.loads(self.dispute_appeals.get(str(dispute_id), "[]"))

    @gl.public.view
    def get_appeal_count(self, dispute_id) -> int:
        return len(json.loads(self.dispute_appeals.get(str(dispute_id), "[]")))

    # -------------------------------------------------------------------------
    # Settlement — dispute_id only; action derived from core's stored verdict
    # -------------------------------------------------------------------------

    @gl.public.write
    def execute_settlement(self, dispute_id):
        if self.paused:
            raise gl.vm.UserError("Contract is paused")
        if gl.message.sender_address != self.core:
            raise gl.vm.UserError("Only core may execute settlement")

        key = str(dispute_id)
        if self.settled_disputes.get(key, False):
            raise gl.vm.UserError("Dispute already settled")

        core = gl.get_contract_at(self.core)
        verdict = core.view().get_verdict(int(dispute_id))
        if not isinstance(verdict, dict):
            raise gl.vm.UserError("No verdict")
        if verdict.get("reviewRequired"):
            raise gl.vm.UserError("Review required; settlement frozen")

        self.settled_disputes[key] = True
        nonce = int(self.next_settlement_nonce)
        self.next_settlement_nonce = u256(nonce + 1)
        self.settlement_nonces[key] = json.dumps(
            {
                "nonce": nonce,
                "disputeId": int(dispute_id),
                "verdict": int(verdict.get("verdict", 0)),
                "resolution": int(verdict.get("resolution", 3)),
                "confidence": int(verdict.get("confidence", 0)),
            }
        )
        return nonce

    @gl.public.view
    def is_settled(self, dispute_id) -> bool:
        return self.settled_disputes.get(str(dispute_id), False)

    @gl.public.view
    def get_settlement_nonce(self, dispute_id) -> int:
        data = self.settlement_nonces.get(str(dispute_id))
        if data is None:
            return 0
        return int(json.loads(data).get("nonce", 0))

    @gl.public.view
    def get_settlement(self, dispute_id) -> dict | None:
        data = self.settlement_nonces.get(str(dispute_id))
        if data is None:
            return None
        return json.loads(data)

    @gl.public.view
    def get_owner(self) -> str:
        return str(self.owner)

    @gl.public.view
    def get_core(self) -> str:
        return str(self.core)
