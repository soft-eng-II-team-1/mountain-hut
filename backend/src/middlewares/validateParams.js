const validateRequest = (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        let error = "The parameters are not formatted properly\n\n";

        errors.array().forEach((e) => {
            error += "- Parameter: **" + e.param + "** - Reason: *" + e.msg + "* - Location: *" + e.location + "*\n\n"
        });

        return res.status(422).json({ error: error });
    }

    return next();
}

export default validateRequest