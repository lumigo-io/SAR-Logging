const AWS = require("aws-sdk");

const mockPutRetentionPolicy = jest.fn();
AWS.CloudWatchLogs.prototype.putRetentionPolicy = mockPutRetentionPolicy;
const mockDescribeLogGroups = jest.fn();
AWS.CloudWatchLogs.prototype.describeLogGroups = mockDescribeLogGroups;

process.env.RETENTION_DAYS = 7;

console.log = jest.fn();

beforeEach(() => {
	process.env.RETRY_MIN_TIMEOUT = "100";
	process.env.RETRY_MAX_TIMEOUT = "100";
  
	mockPutRetentionPolicy.mockReturnValue({
		promise: () => Promise.resolve()
	});
});

afterEach(() => {
	mockPutRetentionPolicy.mockReset();
	mockDescribeLogGroups.mockReset();
});

describe("new log group", () => {
	const handler = require("./set-retention").newLogGroups;

	test("retention policy is updated to 7 days", async () => {
		const event = {
			detail: {
				requestParameters: {
					logGroupName: "/aws/lambda/my-function"
				}
			}
		};
		await handler(event);

		expect(mockPutRetentionPolicy).toBeCalledWith({
			logGroupName: "/aws/lambda/my-function",
			retentionInDays: 7
		});
	});
});

describe("existing log groups", () => {
	const handler = require("./set-retention").existingLogGroups;

	test("retention policy for all log groups are updated to 7 days", async () => {
		givenDescribeLogGroupsReturns([
			{
				logGroupName: "group-1",
				retentionInDays: 5
			}, {
				logGroupName: "group-2",
				retentionInDays: undefined
			}],
		true);
		givenDescribeLogGroupsReturns([
			{
				logGroupName: "group-3",
				retentionInDays: null
			}, {
				logGroupName: "group-4",
				retentionInDays: 7 // this one is ignored
			}
		]);

		await handler();

		expect(mockPutRetentionPolicy).toHaveBeenCalledTimes(3);
		expect(mockPutRetentionPolicy).toBeCalledWith({
			logGroupName: "group-1",
			retentionInDays: 7
		});
		expect(mockPutRetentionPolicy).toBeCalledWith({
			logGroupName: "group-2",
			retentionInDays: 7
		});
		expect(mockPutRetentionPolicy).toBeCalledWith({
			logGroupName: "group-3",
			retentionInDays: 7
		});
	});
  
	describe("error handling", () => {
		beforeEach(() => {
			mockPutRetentionPolicy.mockReset();  
		});
    
		test("it should retry retryable errors when listing log groups", async () => {
			givenDescribeLogGroupsFailsWith("ThrottlingException", "Rate exceeded");
			givenDescribeLogGroupsReturns([]);
  
			await handler();
  
			expect(mockDescribeLogGroups).toBeCalledTimes(2);
		});
    
		test("it should not retry non-retryable errors when listing log groups", async () => {
			givenDescribeLogGroupsFailsWith("Foo", "Bar", false);
  
			await expect(handler()).rejects;
  
			expect(mockDescribeLogGroups).toBeCalledTimes(1);
		});
    
		test("it should retry retryable errors when putting retention policy", async () => {
			givenDescribeLogGroupsReturns([{
				logGroupName: "group-1",
				retentionInDays: null
			}]);
      
			givenPutRetentionPolicyFailsWith("ThrottlingException", "Rate exceeded");
			givenPutRetentionPolicySucceeds();
  
			await expect(handler()).resolves.toEqual(undefined);
  
			expect(mockPutRetentionPolicy).toBeCalledTimes(2);
		});
    
		test("it should not retry non-retryable errors when putting retention policy", async () => {
			givenDescribeLogGroupsReturns([{
				logGroupName: "group-1",
				retentionInDays: null
			}]);
      
			givenPutRetentionPolicyFailsWith("Foo", "Bar", false);
  
			await expect(handler()).resolves.toEqual(undefined);
  
			expect(mockPutRetentionPolicy).toBeCalledTimes(1);
		});
	});
});

const givenDescribeLogGroupsReturns = (logGroups, hasMore = false) => {
	mockDescribeLogGroups.mockReturnValueOnce({
		promise: () => Promise.resolve({
			logGroups: logGroups,
			nextToken: hasMore ? "more" : undefined
		})
	});
};

const givenDescribeLogGroupsFailsWith = (code, message, retryable = true) => {
	mockDescribeLogGroups.mockReturnValueOnce({
		promise: () => Promise.reject(new AwsError(code, message, retryable))
	});
};

const givenPutRetentionPolicySucceeds = () => {
	mockPutRetentionPolicy.mockReturnValueOnce({
		promise: () => Promise.resolve()
	});
};

const givenPutRetentionPolicyFailsWith = (code, message, retryable = true) => {
	mockPutRetentionPolicy.mockReturnValueOnce({
		promise: () => Promise.reject(new AwsError(code, message, retryable))
	});
};

class AwsError extends Error {
	constructor (code, message, retryable) {
		super(message);

		this.code = code;
		this.retryable = retryable;
	}
}
