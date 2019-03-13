# cloudwatch-logs-auto-subscribe

Subscribes new and existing CloudWatch log groups to Lambda/Kinesis/Firehose by ARN.

## Parameters

`DestinationArn`: The ARN of the Lambda function or Kinesis stream to subscribe a newly created CloudWatch log group to.

`Prefix`: (Optional) if specified then only log groups with the prefix will be subscribed. E.g. '/aws/lambda/' will subscribe only Lambda function logs

`FilterName`: (Optional) if specified, will override the filter name for the subscription.

`FilterPattern`: (Optional) if specified, will override the filter pattern used to create the subscription.
