const AWS = require('aws-sdk')
const cloudWatchLogs = new AWS.CloudWatchLogs()
const retentionDays = parseInt(process.env.RETENTION_DAYS)

module.exports.existingLogGroups = async () => {
  const loop = async (nextToken) => {
    const req = {
      nextToken: nextToken
    }
    const resp = await cloudWatchLogs.describeLogGroups(req).promise()

    for (const { logGroupName, retentionInDays } of resp.logGroups) {
      if (retentionInDays !== retentionDays) {
        console.log(`[${logGroupName}] has different retention days [${retentionInDays}], updating...`)
        await setExpiry(logGroupName)
      }
    }

    if (resp.nextToken) {
      await loop(resp.nextToken)
    }
  }

  await loop()
}

module.exports.newLogGroups = async (event) => {
  console.log(JSON.stringify(event))

  const logGroupName = event.detail.requestParameters.logGroupName
  console.log(`log group: ${logGroupName}`)

  await setExpiry(logGroupName)
  console.log(`updated [${logGroupName}]'s retention policy to ${retentionDays} days`)
}

const setExpiry = async (logGroupName) => {
  let params = {
    logGroupName: logGroupName,
    retentionInDays: retentionDays
  }

  await cloudWatchLogs.putRetentionPolicy(params).promise()
}
