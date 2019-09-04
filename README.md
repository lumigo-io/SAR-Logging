# SAR-Logging

[![Greenkeeper badge](https://badges.greenkeeper.io/lumigo/SAR-Logging.svg)](https://greenkeeper.io/)
[![CircleCI](https://circleci.com/gh/lumigo-io/SAR-Logging.svg?style=svg)](https://circleci.com/gh/lumigo-io/SAR-Logging)

Serverless applications for managing CloudWatch Logs log groups for your Lambda functions:

* [cloudwatch-logs-auto-subscribe](packages/cloudwatch-logs-auto-subscribe): SAR app to manage the subscription filter for both new and existing log groups.

* [cloudwatch-logs-auto-set-retention](packages/cloudwatch-logs-auto-set-retention): SAR app to manage the retention policy for both new and existing log groups.

Both can be deployed through the AWS console, as well as with the Serverless or SAM frameworks, or with plain CloudFormation.
