import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as iam from "aws-cdk-lib/aws-iam";
import * as cloudtrail from "aws-cdk-lib/aws-cloudtrail";
import { Construct } from "constructs";

export interface S3StackProps extends cdk.StackProps {
  environment: "development" | "staging" | "production";
}

export class S3Stack extends cdk.Stack {
  public readonly documentBucket: s3.Bucket;
  public readonly bucketAccessRole: iam.Role;

  constructor(scope: Construct, id: string, props: S3StackProps) {
    super(scope, id, props);

    const bucketName = `medibytes-documents-${props.environment}`;

    this.documentBucket = new s3.Bucket(this, "DocumentBucket", {
      bucketName: bucketName,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      lifecycleRules: [
        {
          id: "delete-old-versions",
          noncurrentVersionExpiration: cdk.Duration.days(90),
          enabled: true,
        },
        {
          id: "transition-to-glacier",
          transitions: [
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(180),
            },
          ],
          enabled: true,
        },
      ],
      cors: [
        {
          allowedHeaders: ["*"],
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT, s3.HttpMethods.POST],
          allowedOrigins: [
            process.env.APP_URL || "http://localhost:3000",
            process.env.FRONTEND_URL || "http://localhost:3000"
          ],
          exposedHeaders: ["ETag"],
          maxAge: 3000,
        },
      ],
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const trail = new cloudtrail.Trail(this, "DocumentAccessTrail", {
      trailName: `${bucketName}-trail`,
      sendToCloudWatchLogs: true,
      cloudWatchLogsRetention: cdk.Duration.days(30).toDays(),
      includeGlobalServiceEvents: false,
      managementEvents: cloudtrail.ReadWriteType.NONE,
    });

    trail.addS3EventSelector([
      {
        bucket: this.documentBucket,
        includeManagementEvents: false,
        readWriteType: cloudtrail.ReadWriteType.ALL,
      },
    ]);

    this.bucketAccessRole = new iam.Role(this, "DocumentBucketAccessRole", {
      roleName: `${bucketName}-access-role`,
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
      description: "Role for ECS tasks to access document S3 bucket",
    });

    this.documentBucket.grantReadWrite(this.bucketAccessRole);
    this.documentBucket.grantPutAcl(this.bucketAccessRole);
    
    const bucketPolicy = new iam.PolicyStatement({
      effect: iam.Effect.DENY,
      principals: [new iam.AnyPrincipal()],
      actions: ["s3:*"],
      resources: [
        this.documentBucket.bucketArn,
        `${this.documentBucket.bucketArn}/*`,
      ],
      conditions: {
        StringNotEquals: {
          "aws:SourceArn": this.bucketAccessRole.roleArn,
        },
      },
    });

    this.documentBucket.addToResourcePolicy(bucketPolicy);

    new cdk.CfnOutput(this, "DocumentBucketName", {
      value: this.documentBucket.bucketName,
      description: "Name of the document storage bucket",
    });

    new cdk.CfnOutput(this, "DocumentBucketArn", {
      value: this.documentBucket.bucketArn,
      description: "ARN of the document storage bucket",
    });

    new cdk.CfnOutput(this, "BucketAccessRoleArn", {
      value: this.bucketAccessRole.roleArn,
      description: "ARN of the role for accessing the bucket",
    });
  }
}