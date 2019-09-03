const AWS = require("./lib/aws");
const https = require("https");

const mockInvoke = jest.fn();
AWS.Lambda.prototype.invoke = mockInvoke;

const mockRequest = jest.fn();
https.request = mockRequest;

console.log = jest.fn();

beforeEach(() => {
	mockInvoke.mockReturnValueOnce({
		promise: () => Promise.resolve({})
	});
  
	// eslint-disable-next-line no-unused-vars
	mockRequest.mockImplementation((_options, cb) => {
		return {
			// eslint-disable-next-line no-unused-vars
			on: () => {},
			write: () => {},
			end: () => cb({ on: (_status, cb2) => cb2() })
		};
	});
});

afterEach(() => {
	mockInvoke.mockClear();
});

describe("lambda-invocation", () => {
	const genEvent = (reqType, functionName, payload = {}) => ({
		ResourceType: "Custom::LambdaInvocation",
		RequestType: reqType,
		PhysicalResourceId: "1234",
		ResponseURL: "https://theburningmonk.com",
		ResourceProperties: {
			ServiceToken: "test-token",
			FunctionName: `arn:aws:lambda:us-east-1:374852340823:function:${functionName}`,
			Payload: payload
		}
	});
  
	const thenLambdaIsInvoked = (functionName) => {
		expect(mockInvoke).toBeCalledWith({
			FunctionName: `arn:aws:lambda:us-east-1:374852340823:function:${functionName}`,
			InvocationType: "RequestResponse",
			Payload: "{}"
		});
	};
  
	const thenResponseUrlIsCalled = () => {
		expect(mockRequest).toBeCalledWith(
			expect.objectContaining({
				hostname: "theburningmonk.com",
				port: null,
				path: "/",
				method: "PUT",
				headers: {
					"Content-Type": "",
					"Content-Length": expect.any(Number)
				}
			}), 
			expect.any(Function));
	};

	test("Create events would trigger Lambda invocation", async () => {
		const handler = require("./lambda-invocation").handler;
		await handler(genEvent("Create", "my-function"));
    
		thenLambdaIsInvoked("my-function");
		thenResponseUrlIsCalled();
	});

	test("Update events would trigger Lambda invocation", async () => {
		const handler = require("./lambda-invocation").handler;
		await handler(genEvent("Update", "my-function"));
    
		thenLambdaIsInvoked("my-function");
		thenResponseUrlIsCalled();
	});

	test("Delete events would not trigger Lambda invocation", async () => {
		const handler = require("./lambda-invocation").handler;
		await handler(genEvent("Delete", "my-function"));
    
		expect(mockInvoke).not.toBeCalled();
		thenResponseUrlIsCalled();
	});
  
	test("Should error for unsupported events", async () => {
		const handler = require("./lambda-invocation").handler;
		await expect(handler(genEvent("Dance", "my-function"))).rejects
			.toEqual(new Error("unexpected RequestType [Dance]"));
	});
  
	test("Should error if FunctionName is not an ARN", async () => {
		const handler = require("./lambda-invocation").handler;
		const event = {
			ResourceType: "Custom::LambdaInvocation",
			RequestType: "Create",
			PhysicalResourceId: "1234",
			ResponseURL: "https://theburningmonk.com",
			ResourceProperties: {
				ServiceToken: "test-token",
				FunctionName: "not an ARN",
				Payload: ""
			}
		};
		await handler(event);
    
		expect(mockInvoke).not.toBeCalled();
		thenResponseUrlIsCalled();
	});
});
