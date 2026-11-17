# An independent application proof secret, separate from CHAOS_TOKEN.
# Guard sharing with GCP: copy via a trusted operator channel; do not commit it.
resource "random_password" "security_identity" {
  length  = 48
  special = false
}

resource "aws_secretsmanager_secret" "security_identity" {
  name                    = "${var.project_name}/security-identity"
  recovery_window_in_days = 7
  tags = { Project = var.project_name, Purpose = "security-identity-game-day" }
}

resource "aws_secretsmanager_secret_version" "security_identity" {
  secret_id     = aws_secretsmanager_secret.security_identity.id
  secret_string = random_password.security_identity.result
}

output "security_identity_secret_arn" {
  value = aws_secretsmanager_secret.security_identity.arn
}
