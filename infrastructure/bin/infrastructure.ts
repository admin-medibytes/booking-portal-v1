#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { S3Stack } from "../lib/s3-stack";

const app = new cdk.App();

const environment = process.env.ENVIRONMENT as "development" | "staging" | "production" || "development";
const account = process.env.CDK_DEFAULT_ACCOUNT;
const region = process.env.CDK_DEFAULT_REGION || "ap-southeast-2";

new S3Stack(app, `MedibytesS3Stack-${environment}`, {
  environment,
  env: {
    account,
    region,
  },
  description: "Medibytes document storage infrastructure",
});