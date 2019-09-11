const AWS = require("./aws");
const cloudWatchLogs = new AWS.CloudWatchLogs();
const log = require("@dazn/lambda-powertools-logger");
const retry = require("async-retry");

const { PREFIX, DESTINATION_ARN, FILTER_NAME, FILTER_PATTERN, ROLE_ARN } = process.env;
const isLambda = DESTINATION_ARN.startsWith("arn:aws:lambda");
const filterName = FILTER_NAME || "ship-logs";
const filterPattern = FILTER_PATTERN || "";

const getRetryConfig = (onRetry) => (
	{
		retries: parseInt(process.env.RETRIES || "5"),
		minTimeout: parseFloat(process.env.RETRY_MIN_TIMEOUT || "5000"),
		maxTimeout: parseFloat(process.env.RETRY_MAX_TIMEOUT || "60000"),
		factor: 2,
		onRetry
	}
);

const bailIfErrorNotRetryable = (bail) => (error) => {
	if (!error.retryable) {
		bail(error);
	} else {
		throw error;
	}
};

const getTags = async (logGroupName) => {
	const resp = await retry(
		(bail) => cloudWatchLogs
			.listTagsLogGroup({ logGroupName })
			.promise()
			.catch(bailIfErrorNotRetryable(bail)),
		getRetryConfig((err) => log.warn("retrying listTagsLogGroup after error...", { logGroupName }, err))
	);
  
	return resp.tags;
};

const getSubscriptionFilter = async (logGroupName) => {
	const resp = await retry(
		(bail) => cloudWatchLogs
			.describeSubscriptionFilters({ logGroupName })
			.promise()
			.catch(bailIfErrorNotRetryable(bail)),
		getRetryConfig((err) => log.warn("retrying describeSubscriptionFilter after error...", { logGroupName }, err))
	);
    
	if (resp.subscriptionFilters.length === 0) {
		return null;
	} else {
		return resp.subscriptionFilters[0].destinationArn;
	}
};

const putSubscriptionFilter = async (logGroupName) => {
	// when subscribing a stream to Kinesis/Firehose, you need to specify the roleArn
	const roleArn = !isLambda ? ROLE_ARN : undefined;

	const req = {
		destinationArn: DESTINATION_ARN,
		logGroupName: logGroupName,
		filterName: filterName,
		filterPattern: filterPattern,
		roleArn: roleArn
	};

	log.debug(JSON.stringify(req));

	await retry(
		(bail) => cloudWatchLogs
			.putSubscriptionFilter(req)
			.promise()
			.catch(bailIfErrorNotRetryable(bail)),
		getRetryConfig((err) => log.warn("retrying putSubscriptionFilter after error...", { logGroupName }, err))
	);

	log.info(`subscribed log group to [${DESTINATION_ARN}]`, {
		logGroupName,
		arn: DESTINATION_ARN
	});
};

const getLogGroups = async () => {
	const loop = async (nextToken, acc = []) => {
		const req = {
			nextToken: nextToken,
			logGroupNamePrefix: PREFIX
		};
    
		try {
			const resp = await retry(
				(bail) => cloudWatchLogs
					.describeLogGroups(req)
					.promise()
					.catch(bailIfErrorNotRetryable(bail)),
				getRetryConfig((err) => log.warn("retrying describeLogGroup after error...", { req }, err))
			);
			const logGroupNames = resp.logGroups.map(x => x.logGroupName);
			const newAcc = acc.concat(logGroupNames);

			if (resp.nextToken) {
				return await loop(resp.nextToken, newAcc);
			} else {
				return newAcc;
			}
		} catch (error) {
			log.error(`failed to fetch log groups, processing the fetched groups [${acc.length}] so far`, error);
			return acc; 
		}
	};
  
	return await loop();
};

module.exports = {
	getTags,
	getSubscriptionFilter,
	putSubscriptionFilter,
	getLogGroups
};
