const lambda = require("./lib/lambda");
const cloudWatchLogs = require("./lib/cloudwatch-logs");
const log = require("@dazn/lambda-powertools-logger");

const { FILTER_NAME, DESTINATION_ARN } = process.env;

module.exports.existingLogGroups = async () => {
	const logGroupNames = await cloudWatchLogs.getLogGroups();
	for (const logGroupName of logGroupNames) {
		try {
			if (await filter(logGroupName)) {
				const old = await cloudWatchLogs.getSubscriptionFilter(logGroupName);
				if (!old) {
					log.debug(`[${logGroupName}] doesn't have a filter yet`);
          
					await subscribe(logGroupName);
				} else if (old.destinationArn !== DESTINATION_ARN && old.filterName === FILTER_NAME) {
					log.debug(`[${logGroupName}] has an old destination ARN [${old.destinationArn}], updating...`, {
						logGroupName,
						oldArn: old.destinationArn,
						arn: DESTINATION_ARN
					});
          
					await subscribe(logGroupName);
				} else if (old.destinationArn !== DESTINATION_ARN && process.env.OVERRIDE_MANUAL_CONFIGS === "true") {
					log.info(`[${logGroupName}] has an old destination ARN [${old.destinationArn}] that was added manually, replacing...`, {
						logGroupName,
						oldArn: old.destinationArn,
						oldFilterName: old.filterName,
						arn: DESTINATION_ARN,
						filterName: FILTER_NAME
					});

					await cloudWatchLogs.deleteSubscriptionFilter(logGroupName, old.filterName);
					await subscribe(logGroupNames);
				}
			}
		} catch(error) {
			log.warn("cannot process existing log group, skipped...", { logGroupName }, error);
		}
	}
};

module.exports.newLogGroups = async (event) => {
	log.debug("received event...", { event });

	// eg. /aws/lambda/logging-demo-dev-api
	const logGroupName = event.detail.requestParameters.logGroupName;
	if (await filter(logGroupName)) {
		await subscribe(logGroupName);
	}
};

const filter = async (logGroupName) => {
	log.debug("checking log group...", { logGroupName });
  
	const { PREFIX, EXCLUDE_PREFIX } = process.env;

	if (EXCLUDE_PREFIX && logGroupName.startsWith(EXCLUDE_PREFIX)) {
		log.debug(`ignored [${logGroupName}] because it matches the exclude prefix`, {
			logGroupName,
			excludePrefix: EXCLUDE_PREFIX
		});
		return false;
	}

	if (PREFIX && !logGroupName.startsWith(PREFIX)) {
		log.debug(`ignored [${logGroupName}] because it doesn't match the prefix`, {
			logGroupName,
			prefix: PREFIX
		});
		return false;
	}
  
	const hasRequiredTags = (process.env.TAGS || "")
		.split(",")
		.filter(x => x.length > 0)
		.map(tag => {
			const segments = tag.split("=");

			// e.g. tag1=value1
			if (segments.length === 2) {
				const [tagName, tagValue] = segments;
				return (tags) => tags[tagName] === tagValue;
			} else { // e.g tag2
				const [tagName] = segments;
				return (tags) => tags[tagName];
			}
		});
	if (hasRequiredTags.length > 0) {
		const logGroupTags = await cloudWatchLogs.getTags(logGroupName);
		const matchedTag = hasRequiredTags.find(f => f(logGroupTags));
		if (!matchedTag) {
			log.debug(`ignored [${logGroupName}] because it doesn't have any of the required tags`, {
				logGroupName,
				tags: process.env.TAGS
			});
			return false;
		}
	}

	return true;
};

const subscribe = async (logGroupName) => {
	try {
		await cloudWatchLogs.putSubscriptionFilter(logGroupName);
	} catch (err) {
		log.error("failed to subscribe log group", { logGroupName }, err);

		// when subscribing a log group to a Lambda function, CloudWatch Logs needs permission
		// to invoke the function
		if (err.code === "InvalidParameterException" &&
        err.message === "Could not execute the lambda function. Make sure you have given CloudWatch Logs permission to execute your function.") {
			log.info(`adding lambda:InvokeFunction permission to CloudWatch Logs for [${DESTINATION_ARN}]`);
			await lambda.addLambdaPermission(DESTINATION_ARN);

			// retry!
			await cloudWatchLogs.putSubscriptionFilter(logGroupName);
		} else {
			throw err;
		}
	}
};
