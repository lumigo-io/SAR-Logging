const AWS = require("./aws");
const cloudWatchLogs = new AWS.CloudWatchLogs();
const log = require("@dazn/lambda-powertools-logger");
const retry = require("async-retry");

const bailIfErrorNotRetryable = (bail) => (error) => {
	if (!error.retryable) {
		bail(error);
	} else {
		throw error;
	}
};

const getRetryConfig = (onRetry) => (
	{
		retries: parseInt(process.env.RETRIES || "5"),
		minTimeout: parseFloat(process.env.RETRY_MIN_TIMEOUT || "5000"),
		maxTimeout: parseFloat(process.env.RETRY_MAX_TIMEOUT || "60000"),
		factor: 2,
		onRetry
	}
);

const getLogGroups = async () => {
	const loop = async (nextToken, acc = []) => {
		const req = {
			nextToken: nextToken
		};
    
		try {
			const resp = await retry(
				(bail) => cloudWatchLogs
					.describeLogGroups(req)
					.promise()
					.catch(bailIfErrorNotRetryable(bail)),
				getRetryConfig((err) => log.warn("retrying describeLogGroups after error...", { req }, err))
			);
      
			const logGroups = resp.logGroups.map(x => ({ 
				logGroupName: x.logGroupName,
				retentionInDays: x.retentionInDays
			}));
			const newAcc = acc.concat(logGroups);

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

const setExpiry = async (logGroupName) => {
	const retentionDays = parseInt(process.env.RETENTION_DAYS || "7");
	const req = {
		logGroupName: logGroupName,
		retentionInDays: retentionDays
	};

	await retry(
		(bail) => cloudWatchLogs
			.putRetentionPolicy(req)
			.promise()
			.catch(bailIfErrorNotRetryable(bail)),
		getRetryConfig((err) => log.warn("retrying putRetentionPolicy after error...", { logGroupName }, err))
	)
		.then(() => log.debug(`${logGroupName}: retention policy updated`, { logGroupName }))
		.catch(err => log.error(`${logGroupName}: failed to update retention policy, skipped...`, { logGroupName }, err));
};

module.exports = {
	getLogGroups,
	setExpiry
};
