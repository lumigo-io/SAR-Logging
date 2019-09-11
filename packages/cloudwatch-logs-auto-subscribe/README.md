# cloudwatch-logs-auto-subscribe

[![Version](https://img.shields.io/badge/semver-1.5.0-blue)](template.yml)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

Subscribes **new and existing** CloudWatch log groups to Lambda/Kinesis/Firehose by ARN.

## Deploying to your account (via the console)

Go to this [page](https://serverlessrepo.aws.amazon.com/applications/arn:aws:serverlessrepo:us-east-1:374852340823:applications~auto-subscribe-log-group-to-arn) and click the Deploy button.

## Deploying via SAM/Serverless framework/CloudFormation

To deploy this via SAM, you need something like this in the CloudFormation template:

```yml
AutoSubscribeLogGroups:
  Type: AWS::Serverless::Application
  Properties:
    Location:
      ApplicationId: arn:aws:serverlessrepo:us-east-1:374852340823:applications/auto-subscribe-log-group-to-arn
      SemanticVersion: <enter latest version>
    Parameters:
      DestinationArn: <ARN to Lambda/Kinesis>
      Prefix: <optional, used to target log groups>
      Tags: <optional, used to target log groups>
      ExcludePrefix: <optional, used to target log groups>
      FilterName: <defaults to ship-logs>
      FilterPattern: <defaults to [timestamp=*Z, request_id="*-*", event]>
```

To do the same via `CloudFormation` or the `Serverless` framework, you need to first add the following `Transform`:

```yml
Transform: AWS::Serverless-2016-10-31
```

For more details, read this [post](https://theburningmonk.com/2019/05/how-to-include-serverless-repository-apps-in-serverless-yml/).

## Parameters

`DestinationArn`: The ARN of the Lambda function or Kinesis stream to subscribe a newly created CloudWatch log group to.

`Prefix`: (Optional) if specified then only log groups with the prefix will be subscribed. E.g. `/aws/lambda/` will subscribe only Lambda function logs.

`Tags`: (Optional) if specified then only log groups with one of these tags would be subscribed. E.g. `tag1=value1,tag2,tag3` would match log groups with the `tag1` tag whose value is `value1`, or log groups who just have the tags `tag2` or `tag3` regardless of their values.

`ExcludePrefix`: (Optional) if specified then log groups that match the prefix will not be subscribed. E.g. `/aws/lambda/my-function-` will exclude Lambda function logs for functions that start with `my-function-`.

`FilterName`: (Optional) if specified, will override the filter name for the subscription.

`FilterPattern`: (Optional) if specified, will override the filter pattern used to create the subscription.
