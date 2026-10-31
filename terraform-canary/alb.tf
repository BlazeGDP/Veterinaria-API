resource "aws_lb_target_group" "canary" {
  name        = "vet-api-canary-tg"
  port        = var.container_port
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = data.terraform_remote_state.stable.outputs.vpc_id

  health_check {
    enabled             = true
    path                = "/health"
    protocol            = "HTTP"
    port                = "traffic-port"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 30
    matcher             = "200"
  }

  tags = {
    Name  = "${var.project_name}-canary-target-group"
    Track = "canary"
  }
}

# Acceso de humo a Canary incluso cuando el peso público de Canary sea 0%.
resource "aws_lb_listener_rule" "canary_smoke" {
  listener_arn = data.terraform_remote_state.stable.outputs.alb_listener_arn
  priority     = 10

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.canary.arn
  }

  condition {
    http_header {
      http_header_name = "x-canary"
      values           = ["true"]
    }
  }
}

# Grafana Cloud consulta a Canary por una ruta dedicada, sin mezclarse con el tráfico público.
resource "aws_lb_listener_rule" "canary_metrics" {
  listener_arn = data.terraform_remote_state.stable.outputs.alb_listener_arn
  priority     = 21

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.canary.arn
  }

  condition {
    path_pattern {
      values = ["/metrics/canary"]
    }
  }
}
