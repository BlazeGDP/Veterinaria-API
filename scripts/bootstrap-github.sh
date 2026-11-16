#!/usr/bin/env bash
# Run ONCE in AWS CloudShell. No API, image, Terraform or app deployment here.
set -euo pipefail
export AWS_REGION=us-east-2 AWS_DEFAULT_REGION=us-east-2 AWS_PAGER=""
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export ACCOUNT_ID
export TF_STATE_BUCKET=${TF_STATE_BUCKET:-veterinaria-tfstate-${ACCOUNT_ID}-us-east-2}
USER_NAME=veterinaria-github-v4
POLICY_NAME=VeterinariaGitHubV4Deployment
export BOOTSTRAP_DIR="$HOME/veterinaria-github-bootstrap"
umask 077
mkdir -p "$BOOTSTRAP_DIR"
# Do not turn an AccessDenied into a different creation attempt.
if ! aws s3api head-bucket --bucket "$TF_STATE_BUCKET" 2>"$BOOTSTRAP_DIR/s3-error.txt"; then
  if grep -Eq '404|Not Found|NoSuchBucket' "$BOOTSTRAP_DIR/s3-error.txt"; then
    aws s3api create-bucket --bucket "$TF_STATE_BUCKET" --region us-east-2 --create-bucket-configuration LocationConstraint=us-east-2
  else cat "$BOOTSTRAP_DIR/s3-error.txt" >&2; exit 1; fi
fi
aws s3api put-bucket-versioning --bucket "$TF_STATE_BUCKET" --versioning-configuration Status=Enabled
aws s3api put-bucket-encryption --bucket "$TF_STATE_BUCKET" --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
aws s3api put-public-access-block --bucket "$TF_STATE_BUCKET" --public-access-block-configuration 'BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true'
# This is a dedicated laboratory identity. Policy intentionally covers infrastructure
# services widely; IAM role administration and S3 state are restricted below.
python3 - <<'POLICY'
import json, os, pathlib
account=os.environ['ACCOUNT_ID'];bucket=os.environ['TF_STATE_BUCKET']
s=[{'Sid':'RegionalInfrastructure','Effect':'Allow','Action':['ec2:*','ecs:*','elasticloadbalancing:*','rds:*','ecr:*','logs:*','secretsmanager:*'],'Resource':'*','Condition':{'StringEquals':{'aws:RequestedRegion':'us-east-2'}}},
{'Sid':'CloudFrontInfrastructure','Effect':'Allow','Action':['cloudfront:*'],'Resource':'*'},
{'Sid':'ProjectExecutionRole','Effect':'Allow','Action':['iam:CreateRole','iam:DeleteRole','iam:GetRole','iam:UpdateAssumeRolePolicy','iam:ListRolePolicies','iam:GetRolePolicy','iam:PutRolePolicy','iam:DeleteRolePolicy','iam:ListAttachedRolePolicies','iam:AttachRolePolicy','iam:DetachRolePolicy','iam:TagRole','iam:UntagRole','iam:ListInstanceProfilesForRole'],'Resource':f'arn:aws:iam::{account}:role/api-restful-veterinaria-ecs-execution-role'},
{'Sid':'PassOnlyProjectRoleToEcs','Effect':'Allow','Action':'iam:PassRole','Resource':f'arn:aws:iam::{account}:role/api-restful-veterinaria-ecs-execution-role','Condition':{'StringEquals':{'iam:PassedToService':'ecs-tasks.amazonaws.com'}}},
{'Sid':'ServiceLinkedRoles','Effect':'Allow','Action':'iam:CreateServiceLinkedRole','Resource':'*','Condition':{'StringEquals':{'iam:AWSServiceName':['ecs.amazonaws.com','rds.amazonaws.com','elasticloadbalancing.amazonaws.com','ecs.application-autoscaling.amazonaws.com']}}},
{'Sid':'StateBucketMetadata','Effect':'Allow','Action':['s3:ListBucket','s3:GetBucketLocation'],'Resource':f'arn:aws:s3:::{bucket}'},
{'Sid':'StateAndLock','Effect':'Allow','Action':['s3:GetObject','s3:PutObject','s3:DeleteObject'],'Resource':f'arn:aws:s3:::{bucket}/api-restful-veterinaria/*'}]
pathlib.Path(os.environ['BOOTSTRAP_DIR'],'deployment-policy.json').write_text(json.dumps({'Version':'2012-10-17','Statement':s},indent=2))
POLICY
if ! aws iam get-user --user-name "$USER_NAME" > /dev/null 2>"$BOOTSTRAP_DIR/iam-error.txt"; then
  if grep -q 'NoSuchEntity' "$BOOTSTRAP_DIR/iam-error.txt"; then
    aws iam create-user --user-name "$USER_NAME" >/dev/null
  else cat "$BOOTSTRAP_DIR/iam-error.txt" >&2; exit 1; fi
fi
POLICY_ARN="arn:aws:iam::${ACCOUNT_ID}:policy/${POLICY_NAME}"
if aws iam get-policy --policy-arn "$POLICY_ARN" >/dev/null 2>"$BOOTSTRAP_DIR/policy-error.txt"; then
  # Never delete policy versions implicitly. If limit is reached, surface it.
  aws iam create-policy-version --policy-arn "$POLICY_ARN" --policy-document "file://$BOOTSTRAP_DIR/deployment-policy.json" --set-as-default >/dev/null
else
  if grep -q 'NoSuchEntity' "$BOOTSTRAP_DIR/policy-error.txt"; then
    aws iam create-policy --policy-name "$POLICY_NAME" --policy-document "file://$BOOTSTRAP_DIR/deployment-policy.json" >/dev/null
  else cat "$BOOTSTRAP_DIR/policy-error.txt" >&2; exit 1; fi
fi
aws iam attach-user-policy --user-name "$USER_NAME" --policy-arn "$POLICY_ARN"
if [ ! -s "$BOOTSTRAP_DIR/access-key.json" ]; then
  KEY_COUNT=$(aws iam list-access-keys --user-name "$USER_NAME" --query 'length(AccessKeyMetadata)' --output text)
  if [ "$KEY_COUNT" != 0 ]; then
    echo 'Ya existe una clave para este usuario. Reutiliza la guardada en GitHub; no se puede recuperar su secreto. No se creó otra.' >&2
    exit 1
  fi
  aws iam create-access-key --user-name "$USER_NAME" > "$BOOTSTRAP_DIR/access-key.json"
fi
if [ ! -s "$BOOTSTRAP_DIR/chaos-token" ]; then
  if [ -s "$HOME/veterinaria-config/chaos-token" ]; then
    cp "$HOME/veterinaria-config/chaos-token" "$BOOTSTRAP_DIR/chaos-token"
  else openssl rand -hex 32 > "$BOOTSTRAP_DIR/chaos-token"; fi
fi
chmod 600 "$BOOTSTRAP_DIR/access-key.json" "$BOOTSTRAP_DIR/chaos-token"
printf 'AWS_ACCOUNT_ID=%s\nTF_STATE_BUCKET=%s\n' "$ACCOUNT_ID" "$TF_STATE_BUCKET"
echo 'Preparación terminada. Credenciales guardadas en ~/veterinaria-github-bootstrap; no se imprimieron secretos.'
