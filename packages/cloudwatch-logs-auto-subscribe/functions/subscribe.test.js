const AWS = require("aws-sdk");

const mockListTagsLogGroup = jest.fn();
AWS.CloudWatchLogs.prototype.listTagsLogGroup = mockListTagsLogGroup;
const mockPutSubscriptionFilter = jest.fn();
AWS.CloudWatchLogs.prototype.putSubscriptionFilter = mockPutSubscriptionFilter;
const mockDescribeLogGroups = jest.fn();
AWS.CloudWatchLogs.prototype.describeLogGroups = mockDescribeLogGroups;
const mockDescribeSubscriptionFilters = jest.fn();
AWS.CloudWatchLogs.prototype.describeSubscriptionFilters = mockDescribeSubscriptionFilters;
const mockDeleteSubscriptionFilter = jest.fn();
AWS.CloudWatchLogs.prototype.deleteSubscriptionFilter = mockDeleteSubscriptionFilter;
const mockAddPermission = jest.fn();
AWS.Lambda.prototype.addPermission = mockAddPermission;

const destinationArn = "arn:aws:lambda:us-east-1:123456789:function:boohoo";

console.log = jest.fn();

beforeEach(() => {
	process.env.RETRY_MIN_TIMEOUT = "100";
	process.env.RETRY_MAX_TIMEOUT = "100";
	process.env.SLEEP_BETWEEN_MAX_QUOTA_REQUESTS = "0";
	process.env.AWS_MAX_REQUESTS_PER_SEC_QUOTA = "5";
	process.env.FILTER_NAME = "ship-logs";
	process.env.TAGS_MODE = "OR";
	process.env.EXCLUDE_TAGS_MODE = "OR";
	process.env.DESTINATION_ARN = destinationArn;

	mockPutSubscriptionFilter.mockReturnValue({
		promise: () => Promise.resolve()
	});
  
	mockDeleteSubscriptionFilter.mockReturnValue({
		promise: () => Promise.resolve()
	});

	mockAddPermission.mockReturnValue({
		promise: () => Promise.resolve()
	});
});

afterEach(() => {
	mockPutSubscriptionFilter.mockReset();
	mockDeleteSubscriptionFilter.mockReset();
	mockDescribeLogGroups.mockReset();
	mockDescribeSubscriptionFilters.mockReset();
	mockListTagsLogGroup.mockReset();
  
	delete process.env.PREFIX;
	delete process.env.EXCLUDE_PREFIX;
	delete process.env.TAGS;
	delete process.env.EXCLUDE_TAGS;
});

const givenPrefixIsDefined = () => process.env.PREFIX = "/aws/lambda/";
const givenExcludePrefixIsDefined = () => process.env.EXCLUDE_PREFIX = "/aws/lambda/exclude";
const givenTagsIsDefined = (tags) => process.env.TAGS = tags;
const givenExcludeTagsIsDefined = (tags) => process.env.EXCLUDE_TAGS = tags;

describe("new log group", () => {
	const getEvent = (logGroupName = "/aws/lambda/test-me") => ({
		detail: {
			requestParameters: {
				logGroupName
			}
		}
	});

	describe("prefix", () => {
		test("log group is subscribed if it matches prefix", async () => {
			givenPrefixIsDefined();
			const handler = require("./subscribe").newLogGroups;
			await handler(getEvent());

			expect(mockPutSubscriptionFilter).toBeCalled();
			expect(mockListTagsLogGroup).not.toBeCalled();
		});

		test("log group is not subscribed if it does not match prefix", async () => {
			givenPrefixIsDefined();

			const handler = require("./subscribe").newLogGroups;
			await handler(getEvent("/api/gateway/test-me"));

			expect(mockPutSubscriptionFilter).not.toBeCalled();
		});

		test("any log group would be subscribed when there are no prefix", async () => {
			const handler = require("./subscribe").newLogGroups;
			await handler(getEvent("/api/gateway/test-me"));

			expect(mockPutSubscriptionFilter).toBeCalled();
			expect(mockListTagsLogGroup).not.toBeCalled();
		});
	});

	describe("tags", () => {
		beforeEach(() => {
			mockListTagsLogGroup.mockReturnValueOnce({
				promise: () => Promise.resolve({
					tags: {
						tag1: "value1",
						tag2: "value2"
					}
				})
			});
		});
    
		describe("when TAGS_MODE is OR", () => {
			beforeEach(() => {
				process.env.TAGS_MODE = "OR";
			});

			test("log group is subscribed if it contains at least one matching tag", async () => {
				givenTagsIsDefined("tag2,tag3");
				const handler = require("./subscribe").newLogGroups;
				await handler(getEvent());
  
				expect(mockPutSubscriptionFilter).toBeCalled();
				expect(mockListTagsLogGroup).toBeCalled();
			});
      
			test("log group is subscribed if it contains at least one matching tag AND value", async () => {
				givenTagsIsDefined("tag2=value2,tag3");
				const handler = require("./subscribe").newLogGroups;
				await handler(getEvent());
  
				expect(mockPutSubscriptionFilter).toBeCalled();
				expect(mockListTagsLogGroup).toBeCalled();
			});
      
			test("log group is subscribed if it matches all tags and values", async () => {
				givenTagsIsDefined("tag1=value1,tag2=value2");
				const handler = require("./subscribe").newLogGroups;
				await handler(getEvent());
  
				expect(mockPutSubscriptionFilter).toBeCalled();
				expect(mockListTagsLogGroup).toBeCalled();
			});
		});

		describe("when TAGS_MODE is AND", () => {
			beforeEach(() => {
				process.env.TAGS_MODE = "AND";
			});
      
			test("log group is not subscribed if it contains only one matching tag", async () => {
				givenTagsIsDefined("tag2,tag3");
				const handler = require("./subscribe").newLogGroups;
				await handler(getEvent());
  
				expect(mockPutSubscriptionFilter).not.toBeCalled();
				expect(mockListTagsLogGroup).toBeCalled();
			});
      
			test("log group is not subscribed if it contains only one matching tag AND value", async () => {
				givenTagsIsDefined("tag2=value2,tag3");
				const handler = require("./subscribe").newLogGroups;
				await handler(getEvent());
  
				expect(mockPutSubscriptionFilter).not.toBeCalled();
				expect(mockListTagsLogGroup).toBeCalled();
			});
      
			test("log group is subscribed if it matches all tags and values", async () => {
				givenTagsIsDefined("tag1=value1,tag2=value2");
				const handler = require("./subscribe").newLogGroups;
				await handler(getEvent());
  
				expect(mockPutSubscriptionFilter).toBeCalled();
				expect(mockListTagsLogGroup).toBeCalled();
			});
		});
    
		test("log group is not subscribed if it doesn't contain any matching tag", async () => {
			givenTagsIsDefined("tag3,tag4");
			const handler = require("./subscribe").newLogGroups;
			await handler(getEvent());

			expect(mockPutSubscriptionFilter).not.toBeCalled();
			expect(mockListTagsLogGroup).toBeCalled();
		});
    
		test("log group is not subscribed if its tag value doesn't match", async () => {
			givenTagsIsDefined("tag1=value2");
			const handler = require("./subscribe").newLogGroups;
			await handler(getEvent());

			expect(mockPutSubscriptionFilter).not.toBeCalled();
			expect(mockListTagsLogGroup).toBeCalled();
		});
    
		test("log group is not subscribed if it contains matching tag but wrong prefix", async () => {
			givenTagsIsDefined("tag2,tag3");
			givenPrefixIsDefined();
			const handler = require("./subscribe").newLogGroups;
			await handler(getEvent("/api/gateway/test-me"));

			expect(mockPutSubscriptionFilter).not.toBeCalled();
			expect(mockListTagsLogGroup).not.toBeCalled();
		});
	});

	describe("add Lambda permission", () => {
		test("if encounters Lambda permission error, then attempts to add permission before retrying", async () => {
			givenPutFilterFailsWith(
				"InvalidParameterException",
				"Could not execute the lambda function. Make sure you have given CloudWatch Logs permission to execute your function."
			);

			// succeed when retried
			mockPutSubscriptionFilter.mockReturnValueOnce({
				promise: () => Promise.resolve()
			});

			const handler = require("./subscribe").newLogGroups;
			await handler(getEvent());

			expect(mockAddPermission).toBeCalled();
			expect(mockPutSubscriptionFilter).toBeCalledTimes(2);
		});
	});

	describe("error handling", () => {
		test("it should not handle any errors", async () => {
			mockPutSubscriptionFilter.mockReset();
			mockPutSubscriptionFilter.mockReturnValue({
				promise: () => Promise.reject(new AwsError("boo", "hoo"))
			});

			const handler = require("./subscribe").newLogGroups;
			await expect(handler(getEvent())).rejects.toThrow();

			expect(mockPutSubscriptionFilter).toBeCalled();
		});
	});

	describe("exclude prefix", () => {
		test("should ignore groups that match the exclude prefix", async () => {
			givenExcludePrefixIsDefined();
      
			const handler = require("./subscribe").newLogGroups;
			await handler(getEvent("/aws/lambda/exclude-me"));

			expect(mockPutSubscriptionFilter).not.toBeCalled();
		});
	});

	describe("exclude tags", () => {
		beforeEach(() => {
			mockListTagsLogGroup.mockReturnValueOnce({
				promise: () => Promise.resolve({
					tags: {
						tag1: "value1",
						tag2: "value2"
					}
				})
			});
		});
    
		describe("when TAGS_MODE is OR", () => {
			beforeEach(() => {
				process.env.EXCLUDE_TAGS_MODE = "OR";
			});

			test("log group is not subscribed if it contains at least one matching exclude tag", async () => {
				givenExcludeTagsIsDefined("tag2,tag3");
				const handler = require("./subscribe").newLogGroups;
				await handler(getEvent());
  
				expect(mockPutSubscriptionFilter).not.toBeCalled();
				expect(mockListTagsLogGroup).toBeCalled();
			});
      
			test("log group is not subscribed if it contains at least one matching exclude tag AND value", async () => {
				givenExcludeTagsIsDefined("tag2=value2,tag3");
				const handler = require("./subscribe").newLogGroups;
				await handler(getEvent());
  
				expect(mockPutSubscriptionFilter).not.toBeCalled();
				expect(mockListTagsLogGroup).toBeCalled();
			});
      
			test("log group is not subscribed if it matches all exclude tags and values", async () => {
				givenExcludeTagsIsDefined("tag1=value1,tag2=value2");
				const handler = require("./subscribe").newLogGroups;
				await handler(getEvent());
  
				expect(mockPutSubscriptionFilter).not.toBeCalled();
				expect(mockListTagsLogGroup).toBeCalled();
			});
		});

		describe("when TAGS_MODE is AND", () => {
			beforeEach(() => {
				process.env.EXCLUDE_TAGS_MODE = "AND";
			});
      
			test("log group is subscribed if it contains only one matching exclude tag", async () => {
				givenExcludeTagsIsDefined("tag2,tag3");
				const handler = require("./subscribe").newLogGroups;
				await handler(getEvent());
  
				expect(mockPutSubscriptionFilter).toBeCalled();
				expect(mockListTagsLogGroup).toBeCalled();
			});
      
			test("log group is subscribed if it contains only one matching exclude tag AND value", async () => {
				givenExcludeTagsIsDefined("tag2=value2,tag3");
				const handler = require("./subscribe").newLogGroups;
				await handler(getEvent());
  
				expect(mockPutSubscriptionFilter).toBeCalled();
				expect(mockListTagsLogGroup).toBeCalled();
			});
      
			test("log group is not subscribed if it matches all tags and values", async () => {
				givenExcludeTagsIsDefined("tag1=value1,tag2=value2");
				const handler = require("./subscribe").newLogGroups;
				await handler(getEvent());
  
				expect(mockPutSubscriptionFilter).not.toBeCalled();
				expect(mockListTagsLogGroup).toBeCalled();
			});
		});
    
		test("log group is subscribed if it doesn't contain any matching exclude tag", async () => {
			givenExcludeTagsIsDefined("tag3,tag4");
			const handler = require("./subscribe").newLogGroups;
			await handler(getEvent());

			expect(mockPutSubscriptionFilter).toBeCalled();
			expect(mockListTagsLogGroup).toBeCalled();
		});
    
		test("log group is subscribed if its exclude tag value doesn't match", async () => {
			givenExcludeTagsIsDefined("tag1=value2");
			const handler = require("./subscribe").newLogGroups;
			await handler(getEvent());

			expect(mockPutSubscriptionFilter).toBeCalled();
			expect(mockListTagsLogGroup).toBeCalled();
		});
	});
});

describe("existing log group", () => {
	test("when prefix is not specified, logGroupNamePrefix is ignored in describe log groups", async () => {
		givenDescribeLogGroupsReturns(["/aws/lambda/group1"]);
    
		givenDescribeFiltersReturns(destinationArn); // group1 (ignored)

		const handler = require("./subscribe").existingLogGroups;
		await handler();
    
		expect(mockDescribeLogGroups).toBeCalledWith({
			nextToken: undefined
		});
	});

	test("should replace filters that are different", async () => {
		givenDescribeLogGroupsReturns(["/aws/lambda/group1", "/aws/lambda/group2"], true);
		givenDescribeLogGroupsReturns(["/aws/lambda/group3"]);

		givenDescribeFiltersReturns(destinationArn, "ship-logs", "[event]"); // group1 (replaced)
		givenDescribeFiltersReturns("some-other-arn"); // group2 (replaced)
		givenDescribeFiltersReturns(); // group3 (replaced)

		const handler = require("./subscribe").existingLogGroups;
		await handler();

		expect(mockPutSubscriptionFilter).toBeCalledTimes(3);
		const isReplaced = (logGroupName) => {
			expect(mockPutSubscriptionFilter).toBeCalledWith({
				destinationArn: destinationArn,
				logGroupName,
				filterName: "ship-logs",
				filterPattern: ""
			});
		};
    
		isReplaced("/aws/lambda/group1");
		isReplaced("/aws/lambda/group2");
		isReplaced("/aws/lambda/group3");
	});

	test("should ignore groups that match the exclude prefix", async () => {
		givenExcludePrefixIsDefined();

		givenDescribeLogGroupsReturns(["/aws/lambda/group1", "/aws/lambda/group2"], true);
		givenDescribeLogGroupsReturns(["/aws/lambda/exclude1", "/aws/lambda/exclude2"]);

		givenDescribeFiltersReturns("some-other-arn"); // group1 (replaced)
		givenDescribeFiltersReturns("some-other-arn"); // group2 (replaced)
		givenDescribeFiltersReturns("some-other-arn"); // exclude1 (ignored)
		givenDescribeFiltersReturns("some-other-arn"); // exclude2 (ignored)

		const handler = require("./subscribe").existingLogGroups;
		await handler();

		expect(mockPutSubscriptionFilter).toBeCalledTimes(2);
	});

	test("should subscribe groups that match prefix", async () => {
		givenPrefixIsDefined();

		givenDescribeLogGroupsReturns(["/aws/lambda/group1", "/aws/lambda/group2"], true);
		givenDescribeLogGroupsReturns(["/api/gateway/group1", "/api/gateway/group2"]);

		givenDescribeFiltersReturns("some-other-arn"); // group1 (replaced)
		givenDescribeFiltersReturns("some-other-arn"); // group2 (replaced)
		givenDescribeFiltersReturns("some-other-arn"); // exclude1 (ignored)
		givenDescribeFiltersReturns("some-other-arn"); // exclude2 (ignored)

		const handler = require("./subscribe").existingLogGroups;
		await handler();

		expect(mockPutSubscriptionFilter).toBeCalledTimes(2);
	});
  
	test("should subscribe groups that match both prefix and tags", async () => {
		givenPrefixIsDefined();
		givenTagsIsDefined("tag2,tag3");
    
		givenDescribeLogGroupsReturns(["/aws/lambda/group1", "/aws/lambda/group2"], true);
		givenDescribeLogGroupsReturns(["/api/gateway/group1", "/api/gateway/group2"]);

		givenListTagsReturns({ 
			tag2: "value2"
		}); // group1 (replaced)
		givenListTagsReturns({
			tag2: "value2", 
			tag3: "value3"
		}); // group2 (replaced)
		givenListTagsReturns({
			tag1: "value1"
		}); // api group1 (ignored)
		givenListTagsReturns({
		}); // api group2 (ignored)

		givenDescribeFiltersReturns("some-other-arn"); // group1 (replaced)
		givenDescribeFiltersReturns("some-other-arn"); // group2 (replaced)
		givenDescribeFiltersReturns("some-other-arn"); // exclude1 (ignored)
		givenDescribeFiltersReturns("some-other-arn"); // exclude2 (ignored)

		const handler = require("./subscribe").existingLogGroups;
		await handler();

		expect(mockPutSubscriptionFilter).toBeCalledTimes(2);
	});
  
	test("when there are no prefix nor suffix, everything is subscribed", async () => {
		givenDescribeLogGroupsReturns(["/aws/lambda/group1", "/aws/lambda/group2"]);
    
		givenDescribeFiltersReturns(); // group1 (replaced)
		givenDescribeFiltersReturns(); // group2 (replaced)
    
		const handler = require("./subscribe").existingLogGroups;
		await handler();

		expect(mockPutSubscriptionFilter).toBeCalledTimes(2);
	});
  
	describe("error handling", () => {
		test("it should retry retryable errors when listing log groups", async () => {
			givenDescribeLogGroupsFailsWith("ThrottlingException", "Rate exceeded");
			givenDescribeLogGroupsReturns([]);
  
			const handler = require("./subscribe").existingLogGroups;
			await handler();
  
			expect(mockDescribeLogGroups).toBeCalledTimes(2);
		});
    
		test("it should not retry non-retryable errors when listing log groups", async () => {
			givenDescribeLogGroupsFailsWith("Foo", "Bar", false);
  
			const handler = require("./subscribe").existingLogGroups;
			await expect(handler()).rejects;
  
			expect(mockDescribeLogGroups).toBeCalledTimes(1);
		});

		test("it should retry retryable errors when getting a log group's tags", async () => {
			givenTagsIsDefined("tag1=value1");

			givenDescribeLogGroupsReturns(["/aws/lambda/group1"]);
      
			givenListTagsFailsWith("ThrottlingException", "Rate exceeded");
			givenListTagsReturns({ tag1: "value1" });
  
			const handler = require("./subscribe").existingLogGroups;
			await handler();
  
			expect(mockListTagsLogGroup).toBeCalledTimes(2);
		});

		test("it should not retry non-retryable errors when getting a log group's tags", async () => {
			givenTagsIsDefined("tag1=value1");

			givenDescribeLogGroupsReturns(["/aws/lambda/group1"]);
      
			givenListTagsFailsWith("Foo", "Bar", false);
  
			const handler = require("./subscribe").existingLogGroups;
			await expect(handler()).resolves.toEqual(undefined);
  
			expect(mockListTagsLogGroup).toBeCalledTimes(1);
		});
    
		test("it should retry retryable errors when putting subscription filter", async () => {
			givenDescribeLogGroupsReturns(["/aws/lambda/group1"]);
			givenDescribeFiltersReturns();
      
			mockPutSubscriptionFilter.mockReset();
			givenPutSubscriptionFilterFailsWith("ThrottlingException", "Rate exceeded");
			givenPutSubscriptionFilterSucceeds();
  
			const handler = require("./subscribe").existingLogGroups;
			await handler();
  
			expect(mockPutSubscriptionFilter).toBeCalledTimes(2);
		});

		test("it should not retry non-retryable errors when putting subscription filter", async () => {
			givenDescribeLogGroupsReturns(["/aws/lambda/group1"]);
			givenDescribeFiltersReturns();
      
			mockPutSubscriptionFilter.mockReset();
			givenPutSubscriptionFilterFailsWith("Foo", "Bar", false);

			const handler = require("./subscribe").existingLogGroups;
			await expect(handler()).resolves.toEqual(undefined);
  
			expect(mockPutSubscriptionFilter).toBeCalledTimes(1);
		});
	});
});

describe("unsubscribe", () => {
	test("should ignore groups that match the exclude prefix", async () => {
		givenExcludePrefixIsDefined();

		givenDescribeLogGroupsReturns(["/aws/lambda/group1", "/aws/lambda/group2"], true);
		givenDescribeLogGroupsReturns(["/aws/lambda/exclude1", "/aws/lambda/exclude2"]);

		const handler = require("./subscribe").undo;
		await handler();

		expect(mockDeleteSubscriptionFilter).toBeCalledTimes(2);
	});

	test("should unsubscribe groups that match prefix", async () => {
		givenPrefixIsDefined();

		givenDescribeLogGroupsReturns(["/aws/lambda/group1", "/aws/lambda/group2"], true);
		givenDescribeLogGroupsReturns(["/api/gateway/group1", "/api/gateway/group2"]);

		const handler = require("./subscribe").undo;
		await handler();

		expect(mockDeleteSubscriptionFilter).toBeCalledTimes(2);
	});
  
	test("should unsubscribe groups that match both prefix and tags", async () => {
		givenPrefixIsDefined();
		givenTagsIsDefined("tag2,tag3");
    
		givenDescribeLogGroupsReturns(["/aws/lambda/group1", "/aws/lambda/group2"], true);
		givenDescribeLogGroupsReturns(["/api/gateway/group1", "/api/gateway/group2"]);

		givenListTagsReturns({ 
			tag2: "value2"
		}); // group1 (replaced)
		givenListTagsReturns({
			tag2: "value2", 
			tag3: "value3"
		}); // group2 (replaced)
		givenListTagsReturns({
			tag1: "value1"
		}); // api group1 (ignored)
		givenListTagsReturns({
		}); // api group2 (ignored)

		const handler = require("./subscribe").undo;
		await handler();

		expect(mockDeleteSubscriptionFilter).toBeCalledTimes(2);
	});
  
	test("when there are no prefix nor suffix, everything is unsubscribed", async () => {
		givenDescribeLogGroupsReturns(["/aws/lambda/group1", "/aws/lambda/group2"]);
    
		const handler = require("./subscribe").undo;
		await handler();

		expect(mockDeleteSubscriptionFilter).toBeCalledTimes(2);
	});
});

const givenPutFilterFailsWith = (code, message) => {
	mockPutSubscriptionFilter.mockReturnValueOnce({
		promise: () => Promise.reject(new AwsError(code, message))
	});
};

const givenDescribeLogGroupsFailsWith = (code, message, retryable = true) => {
	mockDescribeLogGroups.mockReturnValueOnce({
		promise: () => Promise.reject(new AwsError(code, message, retryable))
	});
};

const givenListTagsReturns = (tags) => {
	mockListTagsLogGroup.mockReturnValueOnce({
		promise: () => Promise.resolve({
			tags
		})
	});
};

const givenListTagsFailsWith = (code, message, retryable = true) => {
	mockListTagsLogGroup.mockReturnValueOnce({
		promise: () => Promise.reject(new AwsError(code, message, retryable))
	});
};

const givenDescribeLogGroupsReturns = (logGroups, hasMore = false) => {
	mockDescribeLogGroups.mockReturnValueOnce({
		promise: () => Promise.resolve({
			logGroups: logGroups.map(x => ({ logGroupName: x })),
			nextToken: hasMore ? "more" : undefined
		})
	});
};

const givenDescribeFiltersReturns = (arn, filterName = "ship-logs", filterPattern = "[]") => {
	const subscriptionFilters = arn 
		? [{ destinationArn: arn, filterName, filterPattern }] 
		: [];

	mockDescribeSubscriptionFilters.mockReturnValueOnce({
		promise: () => Promise.resolve({
			subscriptionFilters: subscriptionFilters
		})
	});
};

const givenPutSubscriptionFilterSucceeds = () => {
	mockPutSubscriptionFilter.mockReturnValueOnce({
		promise: () => Promise.resolve()
	});
};

const givenPutSubscriptionFilterFailsWith = (code, message, retryable = true) => {
	mockPutSubscriptionFilter.mockReturnValueOnce({
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
