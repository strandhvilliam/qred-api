#!/usr/bin/env node
import "../lib/load-env"
import * as cdk from "aws-cdk-lib"
import { QredStack } from "../lib/qred-stack"

const app = new cdk.App()

const accountRaw =
  process.env.CDK_DEFAULT_ACCOUNT ?? process.env.AWS_ACCOUNT_ID
const account =
  accountRaw !== undefined && accountRaw !== ""
    ? accountRaw.trim()
    : undefined
const region =
  process.env.CDK_DEFAULT_REGION?.trim() ||
  process.env.AWS_DEFAULT_REGION?.trim() ||
  undefined

/** Pin deploy target so CDK does not follow a different default profile/account. */
const env =
  account !== undefined
    ? { account, region: region ?? "eu-west-1" }
    : undefined

new QredStack(app, "QredAssignmentStack", {
  description: "Hono API on Lambda + HTTP API + Aurora DSQL for qred-assignment",
  env,
})

app.synth()
