# cloudwatch-logs-auto-subscribe

[![Version](https://img.shields.io/badge/semver-1.15.0-blue)](template.yml)
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
      TagsMode: <optional, AND or OR, defaults to OR>
      ExcludePrefix: <optional, used to target log groups>
      FilterName: <defaults to ship-logs>
      FilterPattern: <defaults to [timestamp=*Z, request_id="*-*", event]>
      UnsubscribeOnDelete: <optional, whether to unsubscribe the filters that have been added, true or false, defaults to false>
```

To do the same via `CloudFormation` or the `Serverless` framework, you need to first add the following `Transform`:

```yml
Transform: AWS::Serverless-2016-10-31
```

For more details, read this [post](https://theburningmonk.com/2019/05/how-to-include-serverless-repository-apps-in-serverless-yml/).

## Parameters

`DestinationArn`: The ARN of the Lambda function or Kinesis stream to subscribe a newly created CloudWatch log group to.

`Prefix`: (Optional) if specified then only log groups with the prefix will be subscribed. E.g. `/aws/lambda/` will subscribe only Lambda function logs.

`Tags`: (Optional) specify a common separated list of tags, e.g. `tag1=value1,tag2,tag3` Which can test for the existence of a tag (e.g. `tag2`), and can also test the value of the tag too (e.g. `tag1=value1`). Whether the tests are treated with `AND` or `OR` semantics depends on the `TagMode` parameter.

`TagsMode`: (Optional) controls how to combine the different tag tests, whether to join them using AND or OR semantic. Allowed values are `AND` or `OR`.

`ExcludePrefix`: (Optional) if specified then log groups that match the prefix will not be subscribed. E.g. `/aws/lambda/my-function-` will exclude Lambda function logs for functions that start with `my-function-`.

`FilterName`: (Optional) if specified, will override the filter name for the subscription.

`FilterPattern`: (Optional) if specified, will override the filter pattern used to create the subscription.

`UnsubscribeOnDelete`: (Optional) whether to remove the subscription filters that were added by this app. Defaults to "false", allowed values are "true" or "false".

`SleepBetweenMaxQuotaRequests`: (optional) Amount of time in milliseconds to sleep after making {AwsMaxRequestsPerSecQuota} consecutive requests. It might be useful if an AWS account has a large amount of LogGroups or if experiencing Rate Exceeded throttling frequently. Suggested to use a value equal or bellow 1000, as quotas are per second. Defaults to 0.

`AwsMaxRequestsPerSecQuota`: (optional) AWS quota for the max number of requests per second on DescribeLogGroups. This parameter is only used when SleepBetweenMaxQuotaRequests is greater than 0. More info: https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/cloudwatch_limits_cwl.html. Defaults to 5.
