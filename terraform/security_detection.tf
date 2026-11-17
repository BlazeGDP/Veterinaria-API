# Native cloud detection-as-code for scoped machine identity abuses.
# Only activate after enabling the protected proof mode and verifying log format.
resource "aws_cloudwatch_log_metric_filter" "security_identity_denied" {
  count          = var.enable_security_alerts ? 1 : 0
  name           = "${var.project_name}-identity-denied"
  log_group_name = aws_cloudwatch_log_group.api.name
  pattern        = "{ $.event = \"security_event\" && $.experiment = \"identity\" && $.outcome = \"denied\" }"
  metric_transformation {
    name      = "IdentityDenied"
    namespace = "SecurityGameDay/${var.project_name}"
    value     = "1"
  }
}
resource "aws_cloudwatch_metric_alarm" "security_identity_denied" {
  count               = var.enable_security_alerts ? 1 : 0
  alarm_name          = "${var.project_name}-identity-denied"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "IdentityDenied"
  namespace           = "SecurityGameDay/${var.project_name}"
  period              = 60
  statistic           = "Sum"
  threshold           = 1
  treat_missing_data  = "notBreaching"
  alarm_description   = "Detection for denied machine identity requests. Verify alarm history during game day."
  depends_on = [aws_cloudwatch_log_metric_filter.security_identity_denied]
}
