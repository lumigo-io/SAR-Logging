const lambda = require("./lib/lambda");
const cloudWatchLogs = require("./lib/cloudwatch-logs");
const log = require("@dazn/lambda-powertools-logger");

const { FILTER_NAME, DESTINATION_ARN } = process.env;
const SLEEP_BETWEEN_MAX_QUOTA_REQUESTS = parseInt(process.env.SLEEP_BETWEEN_MAX_QUOTA_REQUESTS, 10);
const AWS_MAX_REQUESTS_PER_SEC_QUOTA = parseInt(process.env.AWS_MAX_REQUESTS_PER_SEC_QUOTA, 10);

function sleep(milliseconds) {
	return new Promise(r => setTimeout(r, milliseconds));
}

module.exports.existingLogGroups = async () => {
	const logGroupNames = await cloudWatchLogs.getLogGroups();
	for  (let log_group_index = 0; log_group_index < logGroupNames.length; log_group_index++) {
	  const logGroupName = logGroupNames[log_group_index];
		try {
			if (await filter(logGroupName)) {
				await subscribe(logGroupName);
			}
		} catch(error) {
			log.warn("cannot process existing log group, skipped...", { logGroupName }, error);
		}
		if (SLEEP_BETWEEN_MAX_QUOTA_REQUESTS && ((log_group_index + 1) % AWS_MAX_REQUESTS_PER_SEC_QUOTA == 0)) {
		  await sleep(SLEEP_BETWEEN_MAX_QUOTA_REQUESTS);
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

module.exports.undo = async () => {
	const logGroupNames = await cloudWatchLogs.getLogGroups();
	for (const logGroupName of logGroupNames) {
		try {
			if (await filter(logGroupName)) {
				await unsubscribe(logGroupName);
			}
		} catch(error) {
			log.warn("cannot unsubscribe existing log group, skipped...", { logGroupName }, error);
		}
	}
};

const tagPredicates = tagsCsv =>
	(tagsCsv || "")
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
  
	const excludeTagPredicates = tagPredicates(process.env.EXCLUDE_TAGS);
	const includeTagPredicates = tagPredicates(process.env.TAGS);
  
	if (includeTagPredicates.length === 0 && excludeTagPredicates.length === 0) {
		return true;
	}
      
	const logGroupTags = await cloudWatchLogs.getTags(logGroupName);
  
	if (excludeTagPredicates.length > 0) {
		const isExcluded = 
      process.env.EXCLUDE_TAGS_MODE === "AND"
      	? excludeTagPredicates.every(f => f(logGroupTags))
      	: excludeTagPredicates.some(f => f(logGroupTags));
        
		if (isExcluded) {
			log.debug(`ignored [${logGroupName}] because of exclude tags`, {
				logGroupName,
				logGroupTags,
				excludeTags: process.env.EXCLUDE_TAGS,
				mode: process.env.EXCLUDE_TAGS_MODE
			});
    
			return false;
		}
	}

	if (includeTagPredicates.length > 0) {
		const isIncluded =
    process.env.TAGS_MODE === "AND"
    	? includeTagPredicates.every(f => f(logGroupTags))
    	: includeTagPredicates.some(f => f(logGroupTags));

		if (!isIncluded) {
			log.debug(`ignored [${logGroupName}] because of tags`, {
				logGroupName,
				logGroupTags,
				tags: process.env.TAGS,
				mode: process.env.TAGS_MODE
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

const unsubscribe = async (logGroupName) => {
	try {
		await cloudWatchLogs.deleteSubscriptionFilter(logGroupName, FILTER_NAME);
	} catch (err) {
		log.error("failed to unsubscribe log group", { logGroupName }, err);
	}
};

