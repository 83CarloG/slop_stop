"use strict";

module.exports = function evaluateTaskReadiness(input) {
    const rules = [{
        ruleId: "task_version_approved",
        status: input.task.status === "approved" &&
            input.task.approvedVersion === input.task.currentVersion ? "passed" : "failed"
    }, {
        ruleId: "technical_origin_approved",
        status: input.technicalRequirement.status === "approved" &&
            input.technicalRequirement.approvedVersion === input.task.technicalRequirementVersion ? "passed" : "failed"
    }, {
        ruleId: "functional_origin_approved",
        status: input.functionalRequirement.status === "approved" &&
            input.functionalRequirement.approvedVersion === input.technicalRequirement.functionalRequirementVersion ?
            "passed" : "failed"
    }];
    const status = rules.every(function (rule) {
        return rule.status === "passed";
    }) ? "passed" : "failed";

    return {
        checkId: "approved_chain",
        consequence: status === "passed" ? "allow" : "stop",
        rules,
        status,
        taskId: input.task.id,
        version: input.task.currentVersion
    };
};
