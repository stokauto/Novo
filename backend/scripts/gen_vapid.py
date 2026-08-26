"""
Generate a VAPID key pair for StockAuto Web Push.

Usage:
    python -m scripts.gen_vapid

Prints two lines ready to paste into backend/.env:
    VAPID_PUBLIC_KEY=...
    VAPID_PRIVATE_KEY=...

The private key is emitted as a base64url-encoded 32-byte raw scalar (single
line, safe for .env files). The server converts it to PEM in memory.
"""
import base64
from cryptography.hazmat.primitives.asymmetric import ec


def _b64u(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def main() -> None:
    private = ec.generate_private_key(ec.SECP256R1())
    private_scalar = private.private_numbers().private_value.to_bytes(32, "big")

    public_numbers = private.public_key().public_numbers()
    # Uncompressed EC point: 0x04 || X (32) || Y (32) — the format Web Push expects.
    uncompressed = b"\x04" + public_numbers.x.to_bytes(32, "big") + public_numbers.y.to_bytes(32, "big")

    print("# Paste into backend/.env — do NOT commit these values")
    print(f"VAPID_PUBLIC_KEY={_b64u(uncompressed)}")
    print(f"VAPID_PRIVATE_KEY={_b64u(private_scalar)}")
    print("VAPID_SUBJECT=mailto:admin@stockauto.com.br")


if __name__ == "__main__":
    main()
