import { AdminTicketList } from '../../components/admin/AdminTicketList';

const CancelledTickets = () => {
    return (
        <AdminTicketList
            title="Cancelled Tickets"
            initialStatus={['CANCELLED']}
        />
    );
};

export default CancelledTickets;
