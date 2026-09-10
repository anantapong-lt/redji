from __future__ import annotations

import keyring

SERVICE_NAME = "Readji TTS Agent"
ACCOUNT_NAME = "refresh-token"


def load_refresh_token() -> str | None:
    return keyring.get_password(SERVICE_NAME, ACCOUNT_NAME)


def save_refresh_token(token: str) -> None:
    keyring.set_password(SERVICE_NAME, ACCOUNT_NAME, token)


def clear_refresh_token() -> None:
    try:
        keyring.delete_password(SERVICE_NAME, ACCOUNT_NAME)
    except keyring.errors.PasswordDeleteError:
        pass
