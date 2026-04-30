import * as path from "node:path"
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2"
import * as apigwv2Integrations from "aws-cdk-lib/aws-apigatewayv2-integrations"
import * as dsql from "aws-cdk-lib/aws-dsql"
import * as iam from "aws-cdk-lib/aws-iam"
import * as lambda from "aws-cdk-lib/aws-lambda"
import * as cdk from "aws-cdk-lib"
import type { Construct } from "constructs"

export class QredStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    const appDist = path.join(__dirname, "..", "..", "dist")

    const database = new dsql.CfnCluster(this, "Database", {
      deletionProtectionEnabled: false,
      tags: [
        {
          key: "Name",
          value: `${this.stackName}-database`,
        },
      ],
    })

    const lambdaEnv: Record<string, string> = {
      DSQL_ENDPOINT: database.attrEndpoint,
      DSQL_REGION: cdk.Stack.of(this).region,
      DSQL_USER: "admin",
      DSQL_DATABASE: "postgres",
      JWT_SECRET: process.env.JWT_SECRET!,
      JWT_ISSUER: process.env.JWT_ISSUER!,
      JWT_AUDIENCE: process.env.JWT_AUDIENCE!,
      ENABLE_DEV_ENDPOINTS: process.env.ENABLE_DEV_ENDPOINTS ?? "false",
    }

    const fn = new lambda.Function(this, "ApiFn", {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset(appDist),
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      environment: lambdaEnv,
    })

    fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["dsql:DbConnectAdmin"],
        resources: [database.attrResourceArn],
      }),
    )

    const httpApi = new apigwv2.HttpApi(this, "HttpApi", {
      apiName: `${this.stackName}-http-api`,
    })

    const integration = new apigwv2Integrations.HttpLambdaIntegration("ApiIntegration", fn)

    httpApi.addRoutes({
      path: "/{proxy+}",
      methods: [apigwv2.HttpMethod.ANY],
      integration,
    })

    httpApi.addRoutes({
      path: "/",
      methods: [apigwv2.HttpMethod.ANY],
      integration,
    })

    new cdk.CfnOutput(this, "HttpApiUrl", {
      value: httpApi.apiEndpoint,
      description: "Base URL for the API (no trailing slash)",
    })

    new cdk.CfnOutput(this, "ApiFunctionName", {
      value: fn.functionName,
    })

    new cdk.CfnOutput(this, "DatabaseEndpoint", {
      value: database.attrEndpoint,
      description: "Aurora DSQL PostgreSQL-compatible endpoint",
    })
  }
}
