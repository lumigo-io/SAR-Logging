const AWS = require("./aws");
const lambda = new AWS.Lambda();
const uuid = require("uuid/v4");

const addLambdaPermission = async (functionArn) => {
	const req = {
		Action: "lambda:InvokeFunction",
		FunctionName: functionArn,
		Principal: "logs.amazonaws.com",
		StatementId: `invoke-${uuid().substring(0, 8)}`
	};
	await lambda.addPermission(req).promise();
};

module.exports = {
	addLambdaPermission
};
