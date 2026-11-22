// limit of 8-128 characters (same as backend)
export function checkNewPassword(
  password: string,
  confirm: string,
): {password?: string; confirm?: string} {
  const e: {password?: string; confirm?: string} = {};
  if (password.length < 8 || password.length > 128)
    e.password = "Password must be 8-128 characters long";
  if (!confirm) e.confirm = "Please confirm the new password";
  else if (confirm !== password) e.confirm = "Passwords do not match";
  return e;
}
