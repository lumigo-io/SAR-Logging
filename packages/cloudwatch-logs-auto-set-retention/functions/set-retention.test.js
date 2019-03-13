const AWS = require('aws-sdk')

const mockPutRetentionPolicy = jest.fn()
AWS.CloudWatchLogs.prototype.putRetentionPolicy = mockPutRetentionPolicy
const mockDescribeLogGroups = jest.fn()
AWS.CloudWatchLogs.prototype.describeLogGroups = mockDescribeLogGroups

process.env.RETENTION_DAYS = 7

beforeEach(() => {
  mockPutRetentionPolicy.mockReturnValue({
    promise: () => Promise.resolve()
  })
})

afterEach(() => {
  mockPutRetentionPolicy.mockClear()
  mockDescribeLogGroups.mockClear()
})

describe('new log group', () => {
  const handler = require('./set-retention').newLogGroups

  test('retention policy is updated to 7 days', async () => {
    const event = {
      detail: {
        requestParameters: {
          logGroupName: '/aws/lambda/my-function'
        }
      }
    }
    await handler(event)

    expect(mockPutRetentionPolicy).toBeCalledWith({
      logGroupName: '/aws/lambda/my-function',
      retentionInDays: 7
    })
  })
})

describe('existing log groups', () => {
  const handler = require('./set-retention').existingLogGroups

  test('retention policy for all log groups are updated to 7 days', async () => {
    mockDescribeLogGroups
      .mockReturnValueOnce({
        promise: () => Promise.resolve({
          logGroups: [{
            logGroupName: 'group-1',
            retentionInDays: 5
          }, {
            logGroupName: 'group-2',
            retentionInDays: undefined
          }],
          nextToken: 'more'
        })
      })
      .mockReturnValueOnce({
        promise: () => Promise.resolve({
          logGroups: [{
            logGroupName: 'group-3',
            retentionInDays: null
          }, {
            logGroupName: 'group-4',
            retentionInDays: 7 // this one is ignored
          }]
        })
      })

    await handler()

    expect(mockPutRetentionPolicy).toHaveBeenCalledTimes(3)
    expect(mockPutRetentionPolicy).toBeCalledWith({
      logGroupName: 'group-1',
      retentionInDays: 7
    })
    expect(mockPutRetentionPolicy).toBeCalledWith({
      logGroupName: 'group-2',
      retentionInDays: 7
    })
    expect(mockPutRetentionPolicy).toBeCalledWith({
      logGroupName: 'group-3',
      retentionInDays: 7
    })
  })
})
