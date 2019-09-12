const log = require("@dazn/lambda-powertools-logger");
const cloudWatchLogs = require("./lib/cloudwatch-logs");

module.exports.existingLogGroups = async () => {
	const retentionDays = parseInt(process.env.RETENTION_DAYS || "7");
	const logGroups = await cloudWatchLogs.getLogGroups();
	for (const { logGroupName, retentionInDays } of logGroups) {
		if (retentionInDays !== retentionDays) {
			log.info(
				`${logGroupName}: has different retention days [${retentionInDays}], updating...`, 
				{ logGroupName, retentionDays });
			await cloudWatchLogs.setExpiry(logGroupName);
		}
	}
};

module.exports.newLogGroups = async (event) => {
	log.debug("processing new log group...", { event });

	const logGroupName = event.detail.requestParameters.logGroupName;
	await cloudWatchLogs.setExpiry(logGroupName);
};
