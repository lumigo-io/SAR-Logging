const Joi = require("@hapi/joi");

const LambdaInvocation = Joi.object().keys({
	FunctionName: Joi.string().required(),
	Payload: Joi.object()
});

module.exports = LambdaInvocation;
