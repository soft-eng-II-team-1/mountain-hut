const isLoggedIn = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    } else {
        return res.status(401).json({ message: 'Unauthorized (user is not logged in)' });
    }
};

const isHiker = (req, res, next) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ message: 'Unauthorized (user is not logged in)' });
    }
    if (req.user.role !== 'hiker') {
        return  res.status(403).json({ message: 'Forbidden (not a hiker)' });
    }
    return next();
};

const isEmployee = (req, res, next) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ message: 'Unauthorized (user is not logged in)' });
    }
    if (req.user.role !== 'employee') {
        return res.status(403).json({ message: 'Forbidden (not an employee)' });
    }
    return next();
};

const isStaff = (req, res, next) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ message: 'Unauthorized (user is not logged in)' });
    }
    if (req.user.role !== 'employee' && req.user.role !== 'warden') {
        return res.status(403).json({ message: 'Forbidden (requires employee or warden role)' });
    }
    return next();
};


const isWarden = (req, res, next) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ message: 'Unauthorized (user is not logged in)' });
    }
    if (req.user.role !== 'warden') {
        return res.status(403).json({ message: 'Forbidden (not a warden)' });
    }
    return next();
};

export { isLoggedIn, isHiker, isEmployee, isWarden, isStaff };
