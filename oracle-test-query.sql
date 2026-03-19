-- Oracle SQL Test Query
-- Switch dialect to "Oracle (Beta)" in the dropdown before visualizing

WITH
  top_earners AS (
    SELECT
        e.employee_id,
        e.employee_name,
        e.department_id,
        e.salary,
        SYSDATE AS report_date
    FROM employees e
    WHERE e.hire_date >= ADD_MONTHS(SYSDATE, -12)
  ),
  department_stats AS (
    SELECT
        d.department_id,
        d.department_name,
        COUNT(e.employee_id) AS employee_count,
        AVG(e.salary) AS avg_salary
    FROM departments d
    INNER JOIN employees e ON d.department_id = e.department_id
    GROUP BY d.department_id, d.department_name
  )
SELECT
    te.employee_id,
    te.employee_name,
    te.salary,
    ds.department_name,
    ds.employee_count,
    ds.avg_salary,
    NVL(te.manager_id, 'None') AS manager_id
FROM top_earners te
INNER JOIN department_stats ds ON te.department_id = ds.department_id
WHERE te.salary > 50000
ORDER BY te.salary DESC
FETCH FIRST 20 ROWS ONLY;
