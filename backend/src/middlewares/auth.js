const isLoggedIn = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    } else {
        return res.status(401).json({ message: 'Unauthorized (user is not logged in)' });
    }
};

const isHiker = (req, res, next) => {
    if (req.isAuthenticated() && req.user.role === 'hiker') {
        return next();
    } else {
        return res.status(403).json({ message: 'Forbidden (not a hiker)' });
    }
};

const isEmployee = (req, res, next) => {
    if (req.isAuthenticated() && req.user.role === 'employee') {
        return next();
    } else {
        return res.status(403).json({ message: 'Forbidden (not an employee)' });
    }
};

const isStaff = (req, res, next) => {
    if (req.isAuthenticated() && (req.user.role === 'employee' || req.user.role === 'warden')) {
        return next();
    } else {
        return res.status(403).json({ message: 'Forbidden (requires employee or warden role)' });
    }
};

export { isLoggedIn, isHiker, isEmployee, isStaff };