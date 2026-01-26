import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileSpreadsheet, FileText, Calendar, Users, Wrench, Activity } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { supabase } from '../../lib/supabase';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

const Reports: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [startDate, setStartDate] = useState(format(new Date().setDate(new Date().getDate() - 30), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));


    const exportToExcel = (data: any[], fileName: string) => {
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Report");
        XLSX.writeFile(workbook, `${fileName}_${format(new Date(), 'yyyyMMdd')}.xlsx`);
    };

    const exportToPDF = (title: string, head: string[], body: any[][], fileName: string) => {
        const doc = new jsPDF();
        doc.text(title, 14, 22);
        doc.setFontSize(10);
        doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);

        autoTable(doc, {
            startY: 40,
            head: [head],
            body: body,
        });

        doc.save(`${fileName}_${format(new Date(), 'yyyyMMdd')}.pdf`);
    };

    const generateTicketReport = async (formatType: 'excel' | 'pdf') => {
        setLoading(true);
        try {
            const { data: tickets, error } = await supabase
                .from('tickets')
                .select('*, rider:rider_id(full_name, mobile), technician:technician_id(full_name)')
                .gte('created_at', startDate)
                .lte('created_at', endDate + 'T23:59:59');

            if (error) throw error;

            const reportData = tickets.map(t => ({
                ID: t.ticket_id || t.id.slice(0, 8),
                Date: new Date(t.created_at).toLocaleDateString(),
                Type: t.type,
                Status: t.status,
                Category: t.category,
                Rider: t.rider?.full_name || 'N/A',
                RiderMobile: t.rider?.mobile || 'N/A',
                Technician: t.technician?.full_name || 'Unassigned',
                Rating: t.customer_rating || '-',
            }));

            if (formatType === 'excel') {
                exportToExcel(reportData, 'Ticket_History');
            } else {
                const head = ['ID', 'Date', 'Type', 'Status', 'Category', 'Technician', 'Rating'];
                const body = reportData.map(r => [r.ID, r.Date, r.Type, r.Status, r.Category, r.Technician, r.Rating]);
                exportToPDF('Ticket History Report', head, body, 'Ticket_History');
            }
        } catch (err) {
            console.error(err);
            alert('Failed to generate report');
        } finally {
            setLoading(false);
        }
    };

    const generateTechnicianReport = async (formatType: 'excel' | 'pdf') => {
        setLoading(true);
        try {
            // Fetch techs and their tickets
            const { data: techs, error } = await supabase
                .from('profiles')
                .select('*, tickets:tickets!technician_id(*)')
                .in('role', ['hub_tech', 'rsa_tech']);

            if (error) throw error;

            const reportData = techs.map((tech: any) => {
                const relevantTickets = tech.tickets.filter((t: any) =>
                    t.created_at >= startDate && t.created_at <= endDate + 'T23:59:59'
                );
                const completed = relevantTickets.filter((t: any) => t.status === 'COMPLETED').length;
                const ratings = relevantTickets.filter((t: any) => t.customer_rating).map((t: any) => t.customer_rating);
                const avgRating = ratings.length ? (ratings.reduce((a: any, b: any) => a + b, 0) / ratings.length).toFixed(1) : 'N/A';

                return {
                    Name: tech.full_name || 'Unknown',
                    Role: tech.role,
                    TotalTickets: relevantTickets.length,
                    Completed: completed,
                    CompletionRate: relevantTickets.length ? Math.round((completed / relevantTickets.length) * 100) + '%' : '0%',
                    AvgRating: avgRating
                };
            });

            if (formatType === 'excel') {
                exportToExcel(reportData, 'Technician_Performance');
            } else {
                const head = ['Name', 'Role', 'Total', 'Completed', 'Rate', 'Avg Rating'];
                const body = reportData.map(r => [r.Name, r.Role, r.TotalTickets, r.Completed, r.CompletionRate, r.AvgRating]);
                exportToPDF('Technician Performance Report', head, body, 'Technician_Performance');
            }
        } catch (err) {
            console.error(err);
            alert('Failed to generate report');
        } finally {
            setLoading(false);
        }
    };

    const generateRiderRegistry = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('rider_master')
                .select('*');

            if (error) throw error;

            const reportData = data.map(r => ({
                ID: r.custom_rider_id,
                Name: r.full_name,
                Mobile: r.mobile,
                Chassis: r.chassis_number,
                Wallet: r.wallet_balance,
                Status: r.status || 'active',
                TeamLeader: r.team_leader_name
            }));

            exportToExcel(reportData, 'Rider_Registry');
        } catch (err) {
            console.error(err);
            alert('Failed to generate report');
        } finally {
            setLoading(false);
        }
    };

    const ReportCard: React.FC<{
        title: string;
        desc: string;
        icon: React.ReactNode;
        onExcel?: () => void;
        onPDF?: () => void;
        color: string;
    }> = ({ title, desc, icon, onExcel, onPDF, color }) => (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-all">
            <div className={`p-3 rounded-xl w-fit mb-4 ${color} bg-opacity-20`}>
                {React.cloneElement(icon as any, { className: color.replace('bg-', 'text-') })}
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{title}</h3>
            <p className="text-gray-500 text-sm mb-6 min-h-[40px]">{desc}</p>
            <div className="flex gap-3">
                {onExcel && (
                    <Button variant="outline" size="sm" onClick={onExcel} disabled={loading} className="flex-1 gap-2">
                        <FileSpreadsheet size={16} className="text-green-600" /> Excel
                    </Button>
                )}
                {onPDF && (
                    <Button variant="outline" size="sm" onClick={onPDF} disabled={loading} className="flex-1 gap-2">
                        <FileText size={16} className="text-red-500" /> PDF
                    </Button>
                )}
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-[#0F1117] p-6 pb-20">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <Button variant="ghost" className="mb-4 pl-0 hover:bg-transparent" onClick={() => navigate('/admin')}>
                            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
                        </Button>
                        <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white flex items-center gap-3">
                            <FileText className="text-blue-600" />
                            Reports Center
                        </h1>
                        <p className="text-gray-500 mt-2">Generate and download system-wide reports.</p>
                    </div>
                </div>

                {/* Filters */}
                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2 text-sm font-bold text-gray-700 dark:text-gray-300">
                        <Calendar size={18} /> Date Range:
                    </div>
                    <input
                        type="date"
                        value={startDate}
                        onChange={e => setStartDate(e.target.value)}
                        className="bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white"
                    />
                    <span className="text-gray-400">to</span>
                    <input
                        type="date"
                        value={endDate}
                        onChange={e => setEndDate(e.target.value)}
                        className="bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white"
                    />
                </div>

                {/* Reports Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <ReportCard
                        title="Ticket History"
                        desc="Detailed log of all tickets including status, resolution time, and assignments."
                        icon={<Activity size={24} />}
                        color="bg-blue-500"
                        onExcel={() => generateTicketReport('excel')}
                        onPDF={() => generateTicketReport('pdf')}
                    />
                    <ReportCard
                        title="Technician Performance"
                        desc="Performance metrics for RSA and Hub technicians including ratings and completion rates."
                        icon={<Wrench size={24} />}
                        color="bg-purple-500"
                        onExcel={() => generateTechnicianReport('excel')}
                        onPDF={() => generateTechnicianReport('pdf')}
                    />
                    <ReportCard
                        title="Rider Registry"
                        desc="Complete database of all registered riders, vehicle details, and wallet balances."
                        icon={<Users size={24} />}
                        color="bg-green-500"
                        onExcel={() => generateRiderRegistry()}
                    />
                </div>
            </div>
        </div>
    );
};

export default Reports;
