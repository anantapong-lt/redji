from __future__ import annotations

import json

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


def load_login_credentials(api_url: str) -> tuple[str, str] | None:
    saved = keyring.get_password(SERVICE_NAME, f"login:{api_url.rstrip('/')}")
    if saved is None:
        return None
    credentials = json.loads(saved)
    if not isinstance(credentials, dict):
        raise ValueError("Invalid saved login credentials")
    email, password = credentials.get("email"), credentials.get("password")
    if not isinstance(email, str) or not isinstance(password, str) or not email or not password:
        raise ValueError("Invalid saved login credentials")
    return email, password


def save_login_credentials(api_url: str, email: str, password: str) -> None:
    keyring.set_password(
        SERVICE_NAME, f"login:{api_url.rstrip('/')}",
        json.dumps({"email": email, "password": password}),
    )


def clear_login_credentials(api_url: str) -> None:
    account = f"login:{api_url.rstrip('/')}"
    if keyring.get_password(SERVICE_NAME, account) is not None:
        keyring.delete_password(SERVICE_NAME, account)
