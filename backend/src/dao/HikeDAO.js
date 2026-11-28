import { prisma } from '../../prisma.client.ts';

// Hiker data the staff needs to monitor a hike (contacts in case the hiker does not come back)
const hikerSelect = {
    user_id: true,
    name: true,
    surname: true,
    email: true,
    phone: true,
    emergency_contact: true,
};

// Shape returned to the client: hike information + the hiker on it
const toHikeResponse = (hike) => ({
    hike_id: hike.hike_id,
    destination: hike.destination,
    route: hike.route,
    waypoints: hike.waypoints,
    date_time_start: hike.date_time_start,
    date_time_end: hike.date_time_end,
    hiker: hike.hiker,
});

class HikeDAO {
    //MH-21: hikes already started and not completed yet, i.e. the hiker is currently on the hike
    //(hikes planned for later are excluded). Ordered by expected return time,
    //so the hikers that should be back first are on top
    async getActiveHikes() {
        const hikes = await prisma.hike.findMany({
            where: { completed: false, date_time_start: { lte: new Date() } },
            include: { hiker: { select: hikerSelect } },
            orderBy: [{ date_time_end: 'asc' }, { date_time_start: 'asc' }],
        });
        return hikes.map(toHikeResponse);
    }
}

export default HikeDAO;
