const https = require("https");
const url = require("url");
const Joi = require("@hapi/joi");
const log = require("@dazn/lambda-powertools-logger");

const respond = async (event, status, id, reason) => {
	// e.g. "Custom::DatadogTimeboard" => DatadogTimeboard
	const resourceType = event.ResourceType.replace("Custom::", "");

	const payload = JSON.stringify({
		Status: status,
		RequestId: event.RequestId,
		LogicalResourceId: event.LogicalResourceId,
		StackId: event.StackId,
		PhysicalResourceId: `${resourceType}-${id}`,
		Data: {
			Id: id
		},
		Reason: reason
	});

	const parsedUrl = url.parse(event.ResponseURL);
	const options = {
		hostname: parsedUrl.hostname,
		port: parsedUrl.port,
		path: parsedUrl.path,
		method: "PUT",
		headers: {
			"Content-Type": "",
			"Content-Length": payload.length
		}
	};

	await new Promise((resolve, reject) => {
		const request = https.request(options, function(response) {
			response.on("end", function() {
				resolve();
			});
		});

		request.on("error", function(error) {
			log.error("failed to respond to S3", { url: event.ResponseURL }, error);
			reject(error);
		});

		request.write(payload);
		request.end();
	});  
};

module.exports = (schema, createFn, updateFn, deleteFn) => 
	async (event) => {
		delete event.ResourceProperties.ServiceToken;
		const { error, value } = Joi.validate(
			event.ResourceProperties, schema, { allowUnknown: true });

		if (error) {
			log.error("failed validation", error);
			await respond(event, "FAILED", "Failure", error.message);
			return;
		}

		const apply = async (event, value) => {
			switch (event.RequestType) {
			case "Create":
				return await createFn(value);
			case "Update":
				return await updateFn(event.PhysicalResourceId, value);
			case "Delete":
				return await deleteFn(event.PhysicalResourceId);
			default:
				throw new Error(`unexpected RequestType [${event.RequestType}]`);
			}
		};

		try {
			const id = await apply(event, value);
			await respond(event, "SUCCESS", id);
			log.info("custom resource is created", { id });
		} catch (error) {
			log.error("failed to create custom Lambda invocation resource...", error);
			await respond(event, "FAILED", "Failure", error.message);
			throw error;
		}
	};
