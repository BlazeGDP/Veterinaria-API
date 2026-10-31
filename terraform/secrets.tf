resource "random_password" "db" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

resource "aws_secretsmanager_secret" "db" {
  name                    = "${var.project_name}/database"
  recovery_window_in_days = 0

  tags = {
    Name = "${var.project_name}-database-secret"
  }
}

resource "aws_secretsmanager_secret_version" "db" {
  secret_id = aws_secretsmanager_secret.db.id

  secret_string = jsonencode({
    username = var.db_username
    password = random_password.db.result
  })
}

resource "random_password" "metrics" {
  length  = 48
  special = false
}

resource "aws_secretsmanager_secret" "metrics" {
  name                    = "${var.project_name}/metrics"
  recovery_window_in_days = 0

  tags = {
    Name = "${var.project_name}-metrics-secret"
  }
}

resource "aws_secretsmanager_secret_version" "metrics" {
  secret_id     = aws_secretsmanager_secret.metrics.id
  secret_string = random_password.metrics.result
}
