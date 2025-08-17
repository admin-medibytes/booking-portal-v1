# Medibytes Infrastructure

## S3 Configuration

### Bucket Settings
- **Region**: ap-southeast-2 (Sydney)
- **Encryption**: Server-side encryption with S3-managed keys (AES-256)
- **Versioning**: Enabled for document history tracking
- **Public Access**: All public access blocked
- **Lifecycle Rules**:
  - Old versions deleted after 90 days
  - Objects transitioned to Glacier after 180 days
- **CloudTrail**: All S3 access events logged

### Security Features
1. **Encryption**: All objects encrypted at rest using AES-256
2. **Access Control**: Only ECS tasks with specific IAM role can access
3. **Audit Trail**: CloudTrail logs all data events for compliance
4. **Bucket Policy**: Explicit deny for all principals except authorized role

### Deployment
```bash
# Deploy to development
ENVIRONMENT=development cdk deploy

# Deploy to production
ENVIRONMENT=production cdk deploy
```

### IAM Permissions
The ECS task role includes:
- `s3:PutObject` - Upload documents
- `s3:GetObject` - Download documents
- `s3:DeleteObject` - Delete documents
- `s3:PutObjectAcl` - Set object ACLs
- `s3:ListBucket` - List bucket contents