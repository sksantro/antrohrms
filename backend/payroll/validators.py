import re

PAN_PATTERN = re.compile(r'^[A-Z]{5}[0-9]{4}[A-Z]$')
IFSC_PATTERN = re.compile(r'^[A-Z]{4}0[A-Z0-9]{6}$')
AADHAAR_LAST_FOUR_PATTERN = re.compile(r'^\d{4}$')


def normalize_pan(value: str) -> str:
    return value.strip().upper()


def validate_pan(value: str) -> str:
    pan = normalize_pan(value)
    if not PAN_PATTERN.match(pan):
        raise ValueError('Enter a valid PAN in format ABCDE1234F.')
    return pan


def normalize_ifsc(value: str) -> str:
    return value.strip().upper()


def validate_ifsc(value: str) -> str:
    ifsc = normalize_ifsc(value)
    if not IFSC_PATTERN.match(ifsc):
        raise ValueError('Enter a valid IFSC code in format ABCD0123456.')
    return ifsc


def validate_aadhaar_last_four(value: str) -> str:
    digits = value.strip()
    if not AADHAAR_LAST_FOUR_PATTERN.match(digits):
        raise ValueError('Aadhaar last four must be exactly 4 digits.')
    return digits


def mask_bank_account_number(account_number: str) -> str:
    cleaned = account_number.strip()
    if len(cleaned) <= 4:
        return '*' * len(cleaned)
    return f"{'*' * (len(cleaned) - 4)}{cleaned[-4:]}"
