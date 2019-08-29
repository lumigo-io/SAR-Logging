const AWS = require("aws-sdk");

const mockListTagsLogGroup = jest.fn();
AWS.CloudWatchLogs.prototype.listTagsLogGroup = mockListTagsLogGroup;
const mockPutSubscriptionFilter = jest.fn();
AWS.CloudWatchLogs.prototype.putSubscriptionFilter = mockPutSubscriptionFilter;
const mockDescribeLogGroups = jest.fn();
AWS.CloudWatchLogs.prototype.describeLogGroups = mockDescribeLogGroups;
const mockDescribeSubscriptionFilters = jest.fn();
AWS.CloudWatchLogs.prototype.describeSubscriptionFilters = mockDescribeSubscriptionFilters;
const mockAddPermission = jest.fn();
AWS.Lambda.prototype.addPermission = mockAddPermission;

const destinationArn = "arn:aws:lambda:us-east-1:123456789:function:boohoo";

console.log = jest.fn();

beforeEach(() => {
	process.env.DESTINATION_ARN = destinationArn;

	delete process.env.PREFIX;
	delete process.env.EXCLUDE_PREFIX;
	delete process.env.TAGS;

	mockPutSubscriptionFilter.mockReturnValue({
		promise: () => Promise.resolve()
	});

	mockAddPermission.mockReturnValueOnce({
		promise: () => Promise.resolve()
	});
  
	mockListTagsLogGroup.mockReturnValueOnce({
		promise: () => Promise.resolve({
			tags: ["tag1", "tag2"]
		})
	});
});

afterEach(() => {
	mockPutSubscriptionFilter.mockClear();
	mockDescribeLogGroups.mockClear();
	mockDescribeSubscriptionFilters.mockClear();
	mockListTagsLogGroup.mockClear();
});

const givenPrefixIsDefined = () => process.env.PREFIX = "/aws/lambda/";
const givenExcludePrefixIsDefined = () => process.env.EXCLUDE_PREFIX = "/aws/lambda/exclude";
const givenTagsIsDefined = (tags) => process.env.TAGS = tags;

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
		test("log group is subscribed if it contains at least one matching tag", async () => {
			givenTagsIsDefined("tag2,tag3");
			const handler = require("./subscribe").newLogGroups;
			await handler(getEvent());

			expect(mockPutSubscriptionFilter).toBeCalled();
			expect(mockListTagsLogGroup).toBeCalled();
		});
    
		test("log group is not subscribed if it doesn't contain any matching tag", async () => {
			givenTagsIsDefined("tag3,tag4");
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

	describe("other errors", () => {
		test("it should not handle other errors", async () => {
			givenPutFilterFailsWith("boo", "hoo");

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
});

describe("existing log group", () => {
	test("should replace filters that are different", async () => {
		givenDescribeLogGroupsReturns(["/aws/lambda/group1", "/aws/lambda/group2"], true);
		givenDescribeLogGroupsReturns(["/aws/lambda/group3"]);

		mockDescribeSubscriptionFilters.mockClear();
		givenDescribeFiltersReturns(destinationArn); // group1 (ignored)
		givenDescribeFiltersReturns("some-other-arn"); // group2 (replaced)
		givenDescribeFiltersReturns(); // group3 (replaced)

		const handler = require("./subscribe").existingLogGroups;
		await handler();

		expect(mockPutSubscriptionFilter).toBeCalledTimes(2);
	});

	test("should ignore groups that match the exclude prefix", async () => {
		givenExcludePrefixIsDefined();

		givenDescribeLogGroupsReturns(["/aws/lambda/group1", "/aws/lambda/group2"], true);
		givenDescribeLogGroupsReturns(["/aws/lambda/exclude1", "/aws/lambda/exclude2"]);

		mockDescribeSubscriptionFilters.mockClear();
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

		mockDescribeSubscriptionFilters.mockClear();
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

		mockListTagsLogGroup.mockClear();
		givenListTagsReturns("tag2");         // group1 (replaced)
		givenListTagsReturns("tag2", "tag3"); // group2 (replaced)
		givenListTagsReturns("tag1");         // api group1 (ignored)
		givenListTagsReturns();               // api group2 (ignored)

		mockDescribeSubscriptionFilters.mockClear();
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
    
		mockDescribeSubscriptionFilters.mockClear();
		givenDescribeFiltersReturns(); // group1 (replaced)
		givenDescribeFiltersReturns(); // group2 (replaced)
    
		const handler = require("./subscribe").existingLogGroups;
		await handler();

		expect(mockPutSubscriptionFilter).toBeCalledTimes(2);
	});
});

const givenPutFilterFailsWith = (code, message) => {
	mockPutSubscriptionFilter.mockReturnValueOnce({
		promise: () => Promise.reject(new AwsError(code, message))
	});
};

const givenListTagsReturns = (...tags) => {
	mockListTagsLogGroup.mockReturnValueOnce({
		promise: () => Promise.resolve({
			tags
		})
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

const givenDescribeFiltersReturns = (arn) => {
	const subscriptionFilters = arn ? [{ destinationArn: arn }] : [];

	mockDescribeSubscriptionFilters.mockReturnValueOnce({
		promise: () => Promise.resolve({
			subscriptionFilters: subscriptionFilters
		})
	});
};

class AwsError extends Error {
	constructor (code, message) {
		super(message);

		this.code = code;
	}
}
