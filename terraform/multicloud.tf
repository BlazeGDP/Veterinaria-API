variable "peer_api_url" {
  type    = string
  default = ""
}
variable "chaos_enabled" {
  type    = bool
  default = false
}
variable "chaos_token" {
  type      = string
  sensitive = true
  validation {
    condition     = length(var.chaos_token) >= 32
    error_message = "Usa al menos 32 caracteres aleatorios y el mismo token en ambas APIs."
  }
}
resource "aws_secretsmanager_secret" "chaos" {
  name                    = "${var.project_name}/chaos-v4"
  recovery_window_in_days = 0
}
resource "aws_secretsmanager_secret_version" "chaos" {
  secret_id     = aws_secretsmanager_secret.chaos.id
  secret_string = var.chaos_token
}
