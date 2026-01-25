import { AdminTicketList } from '../../components/admin/AdminTicketList';

const ActiveTickets = () => {
    return (
        <AdminTicketList
            title="Active Tickets"
            initialStatus={['PENDING', 'ACCEPTED', 'IN_PROGRESS']}
        />
    );
};

export default ActiveTickets;
