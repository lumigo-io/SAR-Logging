const AWS = require("./aws");
const cloudWatchLogs = new AWS.CloudWatchLogs();

const { DESTINATION_ARN, FILTER_NAME, FILTER_PATTERN, ROLE_ARN } = process.env;
const isLambda = DESTINATION_ARN.startsWith("arn:aws:lambda");
const filterName = FILTER_NAME || "ship-logs";
const filterPattern = FILTER_PATTERN || "";

const getTags = async (logGroupName) => {
	const resp = await cloudWatchLogs
		.listTagsLogGroup({ logGroupName })
		.promise();    
	return resp.tags;
};

const getSubscriptionFilter = async (logGroupName) => {
	const resp = await cloudWatchLogs
		.describeSubscriptionFilters({ logGroupName: logGroupName })
		.promise();
    
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

	console.log(JSON.stringify(req));

	await cloudWatchLogs.putSubscriptionFilter(req).promise();

	console.log(`subscribed [${logGroupName}] to [${DESTINATION_ARN}]`);
};

const getLogGroups = async () => {
	const loop = async (nextToken, acc = []) => {
		const req = {
			nextToken: nextToken
		};
    
		try {
			const resp = await cloudWatchLogs.describeLogGroups(req).promise();
			const logGroupNames = resp.logGroups.map(x => x.logGroupName);
			const newAcc = acc.concat(logGroupNames);

			if (resp.nextToken) {
				return await loop(resp.nextToken, newAcc);
			} else {
				return newAcc;
			}
		} catch (error) {
			console.error(`failed to fetch log groups, processing the fetched groups [${acc.length}] so far`, error);
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
