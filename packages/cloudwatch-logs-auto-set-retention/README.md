# cloudwatch-logs-auto-set-retention

[![Version](https://img.shields.io/badge/semver-1.2.0-blue)](template.yml)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

Updates the retention policy for **new and existing** CloudWatch log groups to the specified number of days.

## Deploying to your account (via the console)

Go to this [page](https://serverlessrepo.aws.amazon.com/applications/arn:aws:serverlessrepo:us-east-1:374852340823:applications~auto-set-log-group-retention) and click the Deploy button.

## Deploying via SAM/Serverless framework/CloudFormation

To deploy this via SAM, you need something like this in the CloudFormation template:

```yml
AutoSetLogRetention:
  Type: AWS::Serverless::Application
  Properties:
    Location:
      ApplicationId: arn:aws:serverlessrepo:us-east-1:374852340823:applications/auto-set-log-group-retention
      SemanticVersion: <enter latest version>
    Parameters:
      RetentionDays: <defaults to 7>
```

To do the same via `CloudFormation` or the `Serverless` framework, you need to first add the following `Transform`:

```yml
Transform: AWS::Serverless-2016-10-31
```

For more details, read this [post](https://theburningmonk.com/2019/05/how-to-include-serverless-repository-apps-in-serverless-yml/).

## Parameters

`RetentionDays`: The number of days to retain logs in CloudWatch Logs for.
